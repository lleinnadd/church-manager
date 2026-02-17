import { isClient } from '@vueuse/core';
import { useId } from 'reka-ui';
import { h, render } from 'vue';
import type { ChartConfig } from '.';

const cache = new Map<string, string>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function serializeKey(key: Record<string, unknown>): string {
  return JSON.stringify(key, Object.keys(key).sort());
}

interface Constructor<P = unknown> {
  __isFragment?: never;
  __isTeleport?: never;
  __isSuspense?: never;
  new (...args: unknown[]): {
    $props: P;
  };
}

export function componentToString<P>(config: ChartConfig, component: Constructor<P>, props?: P) {
  if (!isClient) return;

  const id = useId();

  return (_data: unknown, x: number | Date) => {
    const data = isRecord(_data) && 'data' in _data ? (_data as { data: unknown }).data : _data;
    const payload = isRecord(data) ? data : { value: data };
    const serializedKey = `${id}-${serializeKey(payload)}`;
    const cachedContent = cache.get(serializedKey);
    if (cachedContent) return cachedContent;

    const vnode = h<unknown>(component, { ...props, payload, config, x });
    const div = document.createElement('div');
    render(vnode, div);
    cache.set(serializedKey, div.innerHTML);
    return div.innerHTML;
  };
}
