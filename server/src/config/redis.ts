import Redis from "ioredis";

export const createRedisClient = () => {
  const redisCluster = new Redis.Cluster(
    [
      { host: "localhost", port: 6379 },
      { host: "localhost", port: 6380 },
      { host: "localhost", port: 6381 },
      { host: "localhost", port: 6382 },
      { host: "localhost", port: 6383 },
      { host: "localhost", port: 6384 },
    ],
    {
      redisOptions: {
        connectTimeout: 10000,
        reconnectOnError: (err: Error) => {
          const targetError = "READONLY";
          if (err.message.includes(targetError)) {
            return true;
          }
          return false;
        },
      },
      clusterRetryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    }
  );

  redisCluster.on("connect", () => {
    console.log("Connected to Redis Cluster!");
  });

  redisCluster.on("error", (err) => {
    console.error("Redis Cluster Error:", err);
  });

  return redisCluster;
};
