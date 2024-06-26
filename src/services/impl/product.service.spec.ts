import {
	describe, it, expect, beforeEach,
	beforeAll,
} from 'vitest';
import {mockDeep, type DeepMockProxy} from 'vitest-mock-extended';
import {PGlite} from '@electric-sql/pglite';
import {drizzle} from 'drizzle-orm/pglite';
import {migrate} from 'drizzle-orm/pglite/migrator';
import {type INotificationService} from '../notifications.port.js';
import {ProductService} from './product.service.js';
import {products, type Product} from '@/db/schema.js';
import * as schema from '@/db/schema.js';

describe('ProductService Tests', () => {
	const client = new PGlite();
	let notificationServiceMock: DeepMockProxy<INotificationService>;
	const databaseMock = drizzle(client, {schema});
	let productService: ProductService;

	beforeAll(async () => {
		await migrate(databaseMock, {migrationsFolder: 'src/db/migrations'});
	});

	beforeEach(() => {
		notificationServiceMock = mockDeep<INotificationService>();
		productService = new ProductService({
			ns: notificationServiceMock,
			db: databaseMock,
		});
	});

	it('should handle delay notification correctly', async () => {
		// GIVEN
		const product: Product = {
			id: 1,
			leadTime: 15,
			available: 0,
			type: 'NORMAL',
			name: 'RJ45 Cable',
			expiryDate: null,
			seasonStartDate: null,
			seasonEndDate: null,
		};
		await databaseMock.insert(products).values(product);

		// WHEN
		await productService.notifyDelay(product.leadTime, product);

		// THEN
		expect(product.available).toBe(0);
		expect(product.leadTime).toBe(15);
		expect(notificationServiceMock.sendDelayNotification).toHaveBeenCalledWith(product.leadTime, product.name);
		const result = await databaseMock.query.products.findFirst({
			where: (product, {eq}) => eq(product.id, product.id),
		});
		expect(result).toEqual(product);
	});

	it('should handle out of stock notification for FLASHSALE product', async () => {
		const d = 24 * 60 * 60 * 1000;
		const productFlash: Product = {
			id: 2,
			leadTime: 0,
			available: 0,
			type: 'FLASHSALE',
			name: 'simple test',
			expiryDate:  null,
			seasonStartDate: null,
			seasonEndDate: null,
		};
		await databaseMock.insert(products).values(productFlash);

		// WHEN
		await productService.handleFlashSalesProduct(productFlash);

		// THEN
		expect(productFlash.available).toBe(0);
		expect(productFlash.leadTime).toBe(0);
		expect(notificationServiceMock.sendOutOfStockNotification).toHaveBeenCalledWith(productFlash.name);
		const result = await databaseMock.query.products.findFirst({
			where: (product, {eq}) => eq(product.id, productFlash.id),
		});
		console.log('result', result);
		expect(result).toEqual(productFlash);
	});
});
