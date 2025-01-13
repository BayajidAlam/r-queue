import Redis from "ioredis";

export const createRedisClient = () => {

  //for docker
  // const redisCluster = new Redis.Cluster([
  //   { host: process.env.REDIS_HOST || "localhost", port: 6379 },
  //   { host: process.env.REDIS_HOST || "localhost", port: 6380 },
  //   { host: process.env.REDIS_HOST || "localhost", port: 6381 },
  //   { host: process.env.REDIS_HOST || "localhost", port: 6382 },
  //   { host: process.env.REDIS_HOST || "localhost", port: 6383 },
  //   { host: process.env.REDIS_HOST || "localhost", port: 6384 },
  // ]);


const redisCluster = new Redis.Cluster([
  { host: process.env.REDIS_1, port: 6379 },
  { host: process.env.REDIS_2, port: 6379 },
  { host: process.env.REDIS_3, port: 6379 },
  { host: process.env.REDIS_4, port: 6379 },
  { host: process.env.REDIS_5, port: 6379 },
  { host: process.env.REDIS_6, port: 6379 }
]);


  // Check if connected
  redisCluster.on("connect", () => {
    console.log("Connected to Redis Cluster!");
  });

  // Enable keyspace notifications for all events (set, del, expired, etc.)
  redisCluster.config("SET", "notify-keyspace-events", "Ex");

  // Subscribe to keyspace notifications
  redisCluster.psubscribe(
    "__keyevent@0__:set",
    "__keyevent@0__:del",
    "__keyevent@0__:expired",
    (err, count) => {
      if (err) {
        console.error("Error subscribing to keyspace events:", err);
      } else {
        console.log("Successfully subscribed to keyspace events.");
      }
    }
  );

  // Handle key events (add, remove, update)
  redisCluster.on("pmessage", (pattern, channel, message) => {
    console.log(`Key event detected!`);
    console.log(`Event: ${message} on channel: ${channel}`);

    if (message === "set") {
      console.log("A key was added or updated.");
    } else if (message === "del") {
      console.log("A key was deleted.");
    } else if (message === "expired") {
      console.log("A key expired.");
    }
  });

  // Handle errors
  redisCluster.on("error", (err) => {
    console.error("Redis Cluster Error:", err);
  });

  return redisCluster;
};
