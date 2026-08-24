import { NotificationPreferencesController } from './notification-preferences.controller';

describe(NotificationPreferencesController.name, () => {
  const service = { getForUser: jest.fn(), update: jest.fn() };
  const controller = new NotificationPreferencesController(service as never);
  const principal = { userId: 'user-id' };

  it('delegates authenticated reads and updates', async () => {
    service.getForUser.mockResolvedValue({ version: 0 });
    service.update.mockResolvedValue({ version: 1 });
    await controller.get(principal as never);
    await controller.update(principal as never, {
      productUpdatesEmail: true,
      marketingEmail: false,
      expectedVersion: 0,
    });
    expect(service.getForUser).toHaveBeenCalledWith('user-id');
    expect(service.update).toHaveBeenCalledWith(
      'user-id',
      expect.objectContaining({ expectedVersion: 0 }),
    );
  });
});
