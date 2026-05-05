declare module 'wake_on_lan' {
  interface WolOptions {
    address?: string;
    port?: number;
  }

  function wake(mac: string, options: WolOptions, callback: (err: Error | null) => void): void;

  export default { wake };
}
