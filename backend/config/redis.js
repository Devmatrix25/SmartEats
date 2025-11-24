import redis from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const REDIS_URL = process.env.REDIS_URL || 'redis://default:TiutVkMQjJuMk5Z6QrvDHbbPd8425K3F@redis-18658.c283.us-east-1-4.ec2.cloud.redislabs.com:18658';
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || 'TiutVkMQjJuMk5Z6QrvDHbbPd8425K3F';
const REDIS_USERNAME = process.env.REDIS_USERNAME || 'default';

class RedisClient {
    constructor() {
        this.client = null;
        this.isConnected = false;
        this.connect();
    }

    async connect() {
        try {
            const options = {
                url: REDIS_URL,
                socket: {
                    connectTimeout: 60000,
                    lazyConnect: true,
                    reconnectStrategy: (retries) => {
                        if (retries > 10) {
                            console.log('Too many attempts to reconnect. Redis connection terminated.');
                            return new Error('Too many retries.');
                        }
                        return Math.min(retries * 100, 3000);
                    }
                }
            };

            // Add authentication if provided
            if (REDIS_USERNAME && REDIS_PASSWORD) {
                options.username = REDIS_USERNAME;
                options.password = REDIS_PASSWORD;
            } else if (REDIS_PASSWORD) {
                options.password = REDIS_PASSWORD;
            }

            this.client = redis.createClient(options);

            // Event listeners
            this.client.on('connect', () => {
                console.log('🔌 Redis client connected');
                this.isConnected = true;
            });

            this.client.on('ready', () => {
                console.log('✅ Redis client ready');
            });

            this.client.on('error', (err) => {
                console.error('❌ Redis client error:', err);
                this.isConnected = false;
            });

            this.client.on('end', () => {
                console.log('🔴 Redis client disconnected');
                this.isConnected = false;
            });

            this.client.on('reconnecting', () => {
                console.log('🔄 Redis client reconnecting');
            });

            await this.client.connect();

        } catch (error) {
            console.error('Failed to connect to Redis:', error);
            this.isConnected = false;
        }
    }

    // Basic key-value operations
    async set(key, value, options = {}) {
        try {
            if (!this.isConnected) {
                throw new Error('Redis client not connected');
            }

            if (options.EX) {
                return await this.client.set(key, value, { EX: options.EX });
            } else if (options.PX) {
                return await this.client.set(key, value, { PX: options.PX });
            } else {
                return await this.client.set(key, value);
            }
        } catch (error) {
            console.error('Redis set error:', error);
            throw error;
        }
    }

    async get(key) {
        try {
            if (!this.isConnected) {
                throw new Error('Redis client not connected');
            }
            return await this.client.get(key);
        } catch (error) {
            console.error('Redis get error:', error);
            throw error;
        }
    }

    async del(key) {
        try {
            if (!this.isConnected) {
                throw new Error('Redis client not connected');
            }
            return await this.client.del(key);
        } catch (error) {
            console.error('Redis del error:', error);
            throw error;
        }
    }

    async exists(key) {
        try {
            if (!this.isConnected) {
                throw new Error('Redis client not connected');
            }
            return await this.client.exists(key);
        } catch (error) {
            console.error('Redis exists error:', error);
            throw error;
        }
    }

    // Set with expiration
    async setEx(key, seconds, value) {
        try {
            if (!this.isConnected) {
                throw new Error('Redis client not connected');
            }
            return await this.client.setEx(key, seconds, value);
        } catch (error) {
            console.error('Redis setEx error:', error);
            throw error;
        }
    }

    // Set with millisecond expiration
    async setPx(key, milliseconds, value) {
        try {
            if (!this.isConnected) {
                throw new Error('Redis client not connected');
            }
            return await this.client.set(key, value, { PX: milliseconds });
        } catch (error) {
            console.error('Redis setPx error:', error);
            throw error;
        }
    }

    // Get time to live
    async ttl(key) {
        try {
            if (!this.isConnected) {
                throw new Error('Redis client not connected');
            }
            return await this.client.ttl(key);
        } catch (error) {
            console.error('Redis ttl error:', error);
            throw error;
        }
    }

    // Expire key
    async expire(key, seconds) {
        try {
            if (!this.isConnected) {
                throw new Error('Redis client not connected');
            }
            return await this.client.expire(key, seconds);
        } catch (error) {
            console.error('Redis expire error:', error);
            throw error;
        }
    }

    // Hash operations
    async hSet(key, field, value) {
        try {
            if (!this.isConnected) {
                throw new Error('Redis client not connected');
            }
            return await this.client.hSet(key, field, value);
        } catch (error) {
            console.error('Redis hSet error:', error);
            throw error;
        }
    }

    async hGet(key, field) {
        try {
            if (!this.isConnected) {
                throw new Error('Redis client not connected');
            }
            return await this.client.hGet(key, field);
        } catch (error) {
            console.error('Redis hGet error:', error);
            throw error;
        }
    }

    async hGetAll(key) {
        try {
            if (!this.isConnected) {
                throw new Error('Redis client not connected');
            }
            return await this.client.hGetAll(key);
        } catch (error) {
            console.error('Redis hGetAll error:', error);
            throw error;
        }
    }

    async hDel(key, field) {
        try {
            if (!this.isConnected) {
                throw new Error('Redis client not connected');
            }
            return await this.client.hDel(key, field);
        } catch (error) {
            console.error('Redis hDel error:', error);
            throw error;
        }
    }

    // List operations
    async lPush(key, value) {
        try {
            if (!this.isConnected) {
                throw new Error('Redis client not connected');
            }
            return await this.client.lPush(key, value);
        } catch (error) {
            console.error('Redis lPush error:', error);
            throw error;
        }
    }

    async rPush(key, value) {
        try {
            if (!this.isConnected) {
                throw new Error('Redis client not connected');
            }
            return await this.client.rPush(key, value);
        } catch (error) {
            console.error('Redis rPush error:', error);
            throw error;
        }
    }

    async lPop(key) {
        try {
            if (!this.isConnected) {
                throw new Error('Redis client not connected');
            }
            return await this.client.lPop(key);
        } catch (error) {
            console.error('Redis lPop error:', error);
            throw error;
        }
    }

    async rPop(key) {
        try {
            if (!this.isConnected) {
                throw new Error('Redis client not connected');
            }
            return await this.client.rPop(key);
        } catch (error) {
            console.error('Redis rPop error:', error);
            throw error;
        }
    }

    async lRange(key, start, stop) {
        try {
            if (!this.isConnected) {
                throw new Error('Redis client not connected');
            }
            return await this.client.lRange(key, start, stop);
        } catch (error) {
            console.error('Redis lRange error:', error);
            throw error;
        }
    }

    // Set operations
    async sAdd(key, member) {
        try {
            if (!this.isConnected) {
                throw new Error('Redis client not connected');
            }
            return await this.client.sAdd(key, member);
        } catch (error) {
            console.error('Redis sAdd error:', error);
            throw error;
        }
    }

    async sRem(key, member) {
        try {
            if (!this.isConnected) {
                throw new Error('Redis client not connected');
            }
            return await this.client.sRem(key, member);
        } catch (error) {
            console.error('Redis sRem error:', error);
            throw error;
        }
    }

    async sMembers(key) {
        try {
            if (!this.isConnected) {
                throw new Error('Redis client not connected');
            }
            return await this.client.sMembers(key);
        } catch (error) {
            console.error('Redis sMembers error:', error);
            throw error;
        }
    }

    async sIsMember(key, member) {
        try {
            if (!this.isConnected) {
                throw new Error('Redis client not connected');
            }
            return await this.client.sIsMember(key, member);
        } catch (error) {
            console.error('Redis sIsMember error:', error);
            throw error;
        }
    }

    // Sorted set operations
    async zAdd(key, score, member) {
        try {
            if (!this.isConnected) {
                throw new Error('Redis client not connected');
            }
            return await this.client.zAdd(key, [{ score, value: member }]);
        } catch (error) {
            console.error('Redis zAdd error:', error);
            throw error;
        }
    }

    async zRange(key, start, stop, options = {}) {
        try {
            if (!this.isConnected) {
                throw new Error('Redis client not connected');
            }
            return await this.client.zRange(key, start, stop, options);
        } catch (error) {
            console.error('Redis zRange error:', error);
            throw error;
        }
    }

    async zRem(key, member) {
        try {
            if (!this.isConnected) {
                throw new Error('Redis client not connected');
            }
            return await this.client.zRem(key, member);
        } catch (error) {
            console.error('Redis zRem error:', error);
            throw error;
        }
    }

    // Pattern matching
    async keys(pattern) {
        try {
            if (!this.isConnected) {
                throw new Error('Redis client not connected');
            }
            return await this.client.keys(pattern);
        } catch (error) {
            console.error('Redis keys error:', error);
            throw error;
        }
    }

    // Scan for keys (better for production)
    async scan(cursor = 0, pattern = '*', count = 100) {
        try {
            if (!this.isConnected) {
                throw new Error('Redis client not connected');
            }
            return await this.client.scan(cursor, {
                MATCH: pattern,
                COUNT: count
            });
        } catch (error) {
            console.error('Redis scan error:', error);
            throw error;
        }
    }

    // Increment/decrement
    async incr(key) {
        try {
            if (!this.isConnected) {
                throw new Error('Redis client not connected');
            }
            return await this.client.incr(key);
        } catch (error) {
            console.error('Redis incr error:', error);
            throw error;
        }
    }

    async decr(key) {
        try {
            if (!this.isConnected) {
                throw new Error('Redis client not connected');
            }
            return await this.client.decr(key);
        } catch (error) {
            console.error('Redis decr error:', error);
            throw error;
        }
    }

    async incrBy(key, increment) {
        try {
            if (!this.isConnected) {
                throw new Error('Redis client not connected');
            }
            return await this.client.incrBy(key, increment);
        } catch (error) {
            console.error('Redis incrBy error:', error);
            throw error;
        }
    }

    // Flush database (use with caution!)
    async flushDb() {
        try {
            if (!this.isConnected) {
                throw new Error('Redis client not connected');
            }
            return await this.client.flushDb();
        } catch (error) {
            console.error('Redis flushDb error:', error);
            throw error;
        }
    }

    // Get Redis info
    async info(section = null) {
        try {
            if (!this.isConnected) {
                throw new Error('Redis client not connected');
            }
            return await this.client.info(section);
        } catch (error) {
            console.error('Redis info error:', error);
            throw error;
        }
    }

    // Ping Redis
    async ping() {
        try {
            if (!this.isConnected) {
                throw new Error('Redis client not connected');
            }
            return await this.client.ping();
        } catch (error) {
            console.error('Redis ping error:', error);
            throw error;
        }
    }

    // Check connection status
    getStatus() {
        return {
            isConnected: this.isConnected,
            url: REDIS_URL
        };
    }

    // Graceful shutdown
    async disconnect() {
        try {
            if (this.client && this.isConnected) {
                await this.client.quit();
                console.log('Redis client disconnected gracefully');
            }
        } catch (error) {
            console.error('Error disconnecting Redis:', error);
        }
    }

    // Reconnect if disconnected
    async ensureConnection() {
        if (!this.isConnected) {
            console.log('Attempting to reconnect to Redis...');
            await this.connect();
        }
        return this.isConnected;
    }
}

// Create singleton instance
const redisClient = new RedisClient();

// Graceful shutdown on process termination
process.on('SIGINT', async () => {
    console.log('SIGINT received, closing Redis connection...');
    await redisClient.disconnect();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('SIGTERM received, closing Redis connection...');
    await redisClient.disconnect();
    process.exit(0);
});

export default redisClient;
