/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { KafkaMessageFactory, TestConsumer, TestKafka } from "@microsoft/fluid-server-test-utils";
import * as assert from "assert";
import { Provider } from "nconf";
import { PartitionManager } from "../../kafka-service/partitionManager";
import { TestPartitionLambdaFactory } from "./testPartitionLambdaFactory";

describe("kafka-service", () => {
    describe("PartitionManager", () => {
        let testManager: PartitionManager;
        let testFactory: TestPartitionLambdaFactory;
        let testKafka: TestKafka;
        let testConsumer: TestConsumer;
        let kafkaMessageFactory: KafkaMessageFactory;

        beforeEach(() => {
            const config = (new Provider({})).defaults({}).use("memory");
            testKafka = new TestKafka();
            testFactory = new TestPartitionLambdaFactory();
            testConsumer = testKafka.createConsumer();
            testManager = new PartitionManager(testFactory, testConsumer, config);
            kafkaMessageFactory = new KafkaMessageFactory();
        });

        describe(".process", () => {
            it("Should be able to stop after processing messages", async () => {
                testConsumer.rebalance();

                const messageCount = 10;
                for (let i = 0; i < messageCount; i++) {
                    testConsumer.emit(kafkaMessageFactory.sequenceMessage({}, "test"));
                }

                await testManager.stop();

                assert.equal(messageCount, testFactory.handleCount);
            });

            it("Should emit an error event if a partition encounters an error", async () => {
                testFactory.setThrowHandler(true);
                testConsumer.rebalance();

                const errorP = new Promise<void>((resolve, reject) => {
                    testManager.on("error", (error, restart) => {
                        assert(error);
                        assert(restart);
                        resolve();
                    });
                });

                testConsumer.emit(kafkaMessageFactory.sequenceMessage({}, "test"));
                await errorP;
            });
        });
    });
});