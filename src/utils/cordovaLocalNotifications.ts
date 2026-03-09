export interface CordovaLocalNotificationPlugin {
  schedule: (notifications: unknown) => void | Promise<unknown>;
  cancel?: (ids: number[] | number) => void | Promise<unknown>;
  hasPermission?: ((callback?: (granted: boolean) => void) => unknown) | undefined;
  requestPermission?: ((callback?: (granted: boolean) => void) => unknown) | undefined;
}

const isPromiseLike = (value: unknown): value is PromiseLike<unknown> => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'then' in value &&
    typeof (value as PromiseLike<unknown>).then === 'function'
  );
};

const normalizePermissionValue = (value: unknown): boolean | null => {
  if (typeof value === 'boolean') {
    return value;
  }

  if (!value || typeof value !== 'object') {
    return null;
  }

  const row = value as Record<string, unknown>;
  const candidates = [
    row.granted,
    row.hasPermission,
    row.allowed,
    row.isEnabled
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'boolean') {
      return candidate;
    }
  }

  return null;
};

const callPermissionMethod = async (
  method: ((callback?: (granted: boolean) => void) => unknown) | undefined,
  timeoutMs: number
): Promise<boolean | null> => {
  if (!method) {
    return null;
  }

  return await new Promise<boolean | null>((resolve) => {
    let settled = false;
    const settle = (value: boolean | null) => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };

    const callback = (granted: boolean) => {
      settle(normalizePermissionValue(granted));
    };

    try {
      const result = method(callback);
      const direct = normalizePermissionValue(result);
      if (direct !== null) {
        settle(direct);
        return;
      }

      if (isPromiseLike(result)) {
        void Promise.resolve(result)
          .then((resolved) => {
            settle(normalizePermissionValue(resolved));
          })
          .catch(() => {
            settle(null);
          });
        return;
      }

      globalThis.setTimeout(() => {
        settle(null);
      }, timeoutMs);
    } catch {
      settle(null);
    }
  });
};

export const isCordovaRuntime = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }

  return Boolean((window as Window & { cordova?: unknown }).cordova);
};

export const getCordovaLocalNotificationPlugin = (): CordovaLocalNotificationPlugin | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const cordovaRef = (
    window as Window & {
      cordova?: {
        plugins?: {
          notification?: {
            local?: CordovaLocalNotificationPlugin;
          };
        };
      };
    }
  ).cordova;

  return cordovaRef?.plugins?.notification?.local ?? null;
};

export const ensureCordovaLocalNotificationPermission = async (
  plugin: CordovaLocalNotificationPlugin | null
): Promise<{ ok: boolean; message?: string }> => {
  if (!plugin) {
    return {
      ok: false,
      message: 'Native notifications are still initializing. Try again in a moment.'
    };
  }

  const hasPermission = await callPermissionMethod(plugin.hasPermission, 1000);

  if (hasPermission === true) {
    return { ok: true };
  }

  const requestedPermission = await callPermissionMethod(plugin.requestPermission, 30000);

  if (requestedPermission === true) {
    return { ok: true };
  }

  const hasPermissionAfterRequest = await callPermissionMethod(plugin.hasPermission, 1000);
  if (hasPermissionAfterRequest === true) {
    return { ok: true };
  }

  if (requestedPermission === false || hasPermissionAfterRequest === false) {
    return {
      ok: false,
      message: 'Notifications are disabled for this app in iPhone Settings.'
    };
  }

  // Unknown plugin permission state: don't block scheduling.
  return { ok: true };
};
