/**
 * RTB API E2E Tests
 * Tests for OpenRTB 2.6 bid endpoints
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { RedisService } from '../../src/shared/redis/redis.service';
import { CacheService } from '../../src/modules/engine/services/cache.service';

describe('RTB API (e2e)', () => {
  let app: INestApplication;
  let redisClient: any;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Get Redis client for test setup
    const redisService = app.get(RedisService);
    redisClient = redisService.client;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/rtb/health (GET)', () => {
    it('should return healthy status', () => {
      return request(app.getHttpServer())
        .get('/rtb/health')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('status', 'healthy');
          expect(res.body).toHaveProperty('protocol', 'OpenRTB 2.6');
        });
    });
  });

  describe('/rtb/test (POST)', () => {
    it('should return test response', () => {
      return request(app.getHttpServer())
        .post('/rtb/test')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('status', 'ok');
          expect(res.body).toHaveProperty('message');
        });
    });
  });

  describe('/rtb/bid (POST)', () => {
    it('should reject invalid bid request (missing id)', () => {
      return request(app.getHttpServer())
        .post('/rtb/bid')
        .send({
          imp: [{ id: 'imp1', banner: { w: 300, h: 250 } }],
        })
        .expect(400);
    });

    it('should reject invalid bid request (missing imp)', () => {
      return request(app.getHttpServer())
        .post('/rtb/bid')
        .send({
          id: 'test-request-1',
        })
        .expect(400);
    });

    it('should return no-bid for empty impression array', () => {
      return request(app.getHttpServer())
        .post('/rtb/bid')
        .send({
          id: 'test-request-2',
          imp: [],
        })
        .expect(200)
        .expect((res) => {
          // Should return no-bid response
          expect(res.body).toHaveProperty('id', 'test-request-2');
          expect(res.body).not.toHaveProperty('seatbid');
        });
    });

    it('should process valid banner bid request', () => {
      return request(app.getHttpServer())
        .post('/rtb/bid')
        .send({
          id: 'test-request-3',
          imp: [
            {
              id: 'imp1',
              banner: {
                w: 300,
                h: 250,
              },
            },
          ],
          site: {
            id: 'site1',
            domain: 'example.com',
          },
          device: {
            ip: '8.8.8.8',
            ua: 'Mozilla/5.0',
          },
        })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('id', 'test-request-3');
        });
    });

    it('should handle bid floor correctly', () => {
      return request(app.getHttpServer())
        .post('/rtb/bid')
        .send({
          id: 'test-request-4',
          imp: [
            {
              id: 'imp1',
              banner: { w: 300, h: 250 },
              bidfloor: 100, // Very high floor
              bidfloorcur: 'USD',
            },
          ],
          site: {
            id: 'site1',
            domain: 'example.com',
          },
          device: {
            ip: '8.8.8.8',
          },
        })
        .expect(200)
        .expect((res) => {
          // With high bid floor, likely no-bid
          expect(res.body).toHaveProperty('id', 'test-request-4');
        });
    });

    it('should process video impression', () => {
      return request(app.getHttpServer())
        .post('/rtb/bid')
        .send({
          id: 'test-request-5',
          imp: [
            {
              id: 'imp1',
              video: {
                mimes: ['video/mp4'],
                minduration: 5,
                maxduration: 30,
                w: 640,
                h: 360,
              },
            },
          ],
          site: {
            id: 'site1',
            domain: 'video.example.com',
          },
          device: {
            ip: '8.8.8.8',
          },
        })
        .expect(200);
    });

    it('should handle app context', () => {
      return request(app.getHttpServer())
        .post('/rtb/bid')
        .send({
          id: 'test-request-6',
          imp: [
            {
              id: 'imp1',
              banner: { w: 320, h: 50 },
            },
          ],
          app: {
            id: 'app1',
            name: 'Test App',
            bundle: 'com.example.app',
          },
          device: {
            ip: '8.8.8.8',
            devicetype: 4,
          },
        })
        .expect(200);
    });

    it('should handle user data', () => {
      return request(app.getHttpServer())
        .post('/rtb/bid')
        .send({
          id: 'test-request-7',
          imp: [
            {
              id: 'imp1',
              banner: { w: 300, h: 250 },
            },
          ],
          site: {
            id: 'site1',
            domain: 'example.com',
          },
          device: {
            ip: '8.8.8.8',
          },
          user: {
            id: 'user123',
            yob: 1990,
            gender: 'M',
          },
        })
        .expect(200);
    });
  });

  describe('/rtb/win (GET)', () => {
    it('should reject missing parameters', () => {
      return request(app.getHttpServer())
        .get('/rtb/win')
        .expect(400);
    });

    it('should accept valid win notice', () => {
      return request(app.getHttpServer())
        .get('/rtb/win?campaign_id=1&creative_id=1&price=1.5')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('status', 'ok');
        });
    });
  });

  describe('/rtb/loss (GET)', () => {
    it('should reject missing parameters', () => {
      return request(app.getHttpServer())
        .get('/rtb/loss')
        .expect(400);
    });

    it('should accept valid loss notice', () => {
      return request(app.getHttpServer())
        .get('/rtb/loss?campaign_id=1&creative_id=1')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('status', 'ok');
        });
    });
  });
});
