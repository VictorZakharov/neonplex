import { FullscreenController } from './FullscreenController';

const createWindow = (coarsePointer: boolean, maxTouchPoints = 0): Window =>
  ({
    matchMedia: jest.fn(() => ({ matches: coarsePointer })),
    navigator: { maxTouchPoints },
  }) as unknown as Window;

const createDocument = (
  requestFullscreen?: jest.Mock<Promise<void>, [FullscreenOptions?]>,
  fullscreenElement: Element | null = null,
  fullscreenEnabled = true,
): Document =>
  ({
    documentElement: { requestFullscreen },
    fullscreenElement,
    fullscreenEnabled,
  }) as unknown as Document;

describe('FullscreenController', () => {
  it('requests hidden-navigation fullscreen on coarse-pointer devices', async () => {
    const requestFullscreen = jest.fn<Promise<void>, [FullscreenOptions?]>(() =>
      Promise.resolve(),
    );
    const controller = new FullscreenController(
      createDocument(requestFullscreen),
      createWindow(true),
    );

    await expect(controller.requestForGameplay(true)).resolves.toBe(true);
    expect(requestFullscreen).toHaveBeenCalledWith({ navigationUI: 'hide' });
  });

  it('also requests fullscreen for touch devices without a coarse-pointer match', async () => {
    const requestFullscreen = jest.fn<Promise<void>, [FullscreenOptions?]>(() =>
      Promise.resolve(),
    );
    const controller = new FullscreenController(
      createDocument(requestFullscreen),
      createWindow(false, 5),
    );

    await expect(controller.requestForGameplay(true)).resolves.toBe(true);
    expect(requestFullscreen).toHaveBeenCalledTimes(1);
  });

  it('does not force desktop pointer devices into fullscreen', async () => {
    const requestFullscreen = jest.fn<Promise<void>, [FullscreenOptions?]>(() =>
      Promise.resolve(),
    );
    const controller = new FullscreenController(
      createDocument(requestFullscreen),
      createWindow(false),
    );

    await expect(controller.requestForGameplay(true)).resolves.toBe(false);
    expect(requestFullscreen).not.toHaveBeenCalled();
  });

  it('does not force fullscreen for mouse input on touch-capable hardware', async () => {
    const requestFullscreen = jest.fn<Promise<void>, [FullscreenOptions?]>(() =>
      Promise.resolve(),
    );
    const controller = new FullscreenController(
      createDocument(requestFullscreen),
      createWindow(true, 5),
    );

    await expect(controller.requestForGameplay(false)).resolves.toBe(false);
    expect(requestFullscreen).not.toHaveBeenCalled();
  });

  it('does not repeat the request while fullscreen is already active', async () => {
    const requestFullscreen = jest.fn<Promise<void>, [FullscreenOptions?]>(() =>
      Promise.resolve(),
    );
    const controller = new FullscreenController(
      createDocument(requestFullscreen, {} as Element),
      createWindow(true),
    );

    await expect(controller.requestForGameplay(true)).resolves.toBe(true);
    expect(requestFullscreen).not.toHaveBeenCalled();
  });

  it('fails safely when fullscreen is disabled, unsupported, or rejected', async () => {
    const disabledRequest = jest.fn<Promise<void>, [FullscreenOptions?]>(() =>
      Promise.resolve(),
    );
    const disabledController = new FullscreenController(
      createDocument(disabledRequest, null, false),
      createWindow(true),
    );
    await expect(disabledController.requestForGameplay(true)).resolves.toBe(false);
    expect(disabledRequest).not.toHaveBeenCalled();

    const unsupportedController = new FullscreenController(
      createDocument(),
      createWindow(true),
    );
    await expect(unsupportedController.requestForGameplay(true)).resolves.toBe(false);

    const requestFullscreen = jest.fn<Promise<void>, [FullscreenOptions?]>(() =>
      Promise.reject(new DOMException('Denied', 'NotAllowedError')),
    );
    const rejectedController = new FullscreenController(
      createDocument(requestFullscreen),
      createWindow(true),
    );
    await expect(rejectedController.requestForGameplay(true)).resolves.toBe(false);
  });

  it('contains synchronous browser API failures', async () => {
    const requestFullscreen = jest.fn<Promise<void>, [FullscreenOptions?]>(() => {
      throw new DOMException('Denied', 'NotAllowedError');
    });
    const controller = new FullscreenController(
      createDocument(requestFullscreen),
      createWindow(true),
    );

    await expect(controller.requestForGameplay(true)).resolves.toBe(false);
  });

  it('deduplicates concurrent requests and stops after fullscreen becomes active', async () => {
    let resolveRequest: (() => void) | undefined;
    const firstRequest = new Promise<void>((resolve) => {
      resolveRequest = resolve;
    });
    const requestFullscreen = jest
      .fn<Promise<void>, [FullscreenOptions?]>()
      .mockReturnValue(firstRequest);
    const documentRef = createDocument(requestFullscreen);
    const controller = new FullscreenController(
      documentRef,
      createWindow(true),
    );

    const firstResult = controller.requestForGameplay(true);
    const concurrentResult = controller.requestForGameplay(true);
    expect(concurrentResult).toBe(firstResult);
    expect(requestFullscreen).toHaveBeenCalledTimes(1);

    resolveRequest?.();
    await expect(firstResult).resolves.toBe(true);
    Reflect.set(documentRef, 'fullscreenElement', {} as Element);
    await expect(controller.requestForGameplay(true)).resolves.toBe(true);
    expect(requestFullscreen).toHaveBeenCalledTimes(1);
  });

  it('does not force another request after a browser rejection', async () => {
    const requestFullscreen = jest
      .fn<Promise<void>, [FullscreenOptions?]>()
      .mockRejectedValueOnce(new DOMException('Denied', 'NotAllowedError'))
      .mockResolvedValueOnce();
    const controller = new FullscreenController(
      createDocument(requestFullscreen),
      createWindow(true),
    );

    await expect(controller.requestForGameplay(true)).resolves.toBe(false);
    await expect(controller.requestForGameplay(true)).resolves.toBe(false);
    expect(requestFullscreen).toHaveBeenCalledTimes(1);
  });
});
