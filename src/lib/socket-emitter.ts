import { Emitter } from "@socket.io/redis-emitter";
import { redis } from "./redis";

export const socketEmitter = new Emitter(redis);
