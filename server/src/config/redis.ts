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
  
  // Handle errors
  redisCluster.on("error", (err) => {
    console.error("Redis Cluster Error:", err);
  });

  return redisCluster;
};
