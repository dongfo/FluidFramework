import { Provider } from "nconf";
import * as winston from "winston";
import * as utils from "../utils";
import { ICheckpointStrategy } from "./checkpointManager";
import { IPartitionLambdaFactory } from "./lambdas";
import { Partition } from "./partition";

// Partition contains a collection of threads
// Threads execute a lambda handler and in order
// Thread maintains an execution context across call
// Partition queries threads for how far completed they are

/**
 * The PartitionManager is responsible for maintaining a list of partitions for the given Kafka topic.
 * It will route incoming messages to the appropriate partition for the messages.
 */
export class PartitionManager {
    private partitions = new Map<number, Partition>();

    constructor(
        private factory: IPartitionLambdaFactory,
        private checkpointStrategy: ICheckpointStrategy,
        private consumer: utils.kafkaConsumer.IConsumer,
        private config: Provider) {
    }

    public async stop(): Promise<void> {
        // And then wait for each partition to fully process all messages
        const partitionsStoppedP: Array<Promise<void>> = [];
        for (const [, partition] of this.partitions) {
            const stopP = partition.stop();
            partitionsStoppedP.push(stopP);
        }
        await Promise.all(partitionsStoppedP);
    }

    public process(message: utils.kafkaConsumer.IMessage) {
        winston.verbose(`${message.topic}:${message.partition}@${message.offset}`);

        // Create the partition if this is the first message we've seen
        if (!this.partitions.has(message.partition)) {
            const newPartition = new Partition(
                message.partition,
                this.factory,
                this.checkpointStrategy,
                this.consumer,
                this.config);
            this.partitions.set(message.partition, newPartition);
        }

        const partition = this.partitions.get(message.partition);
        partition.process(message);
    }
}
