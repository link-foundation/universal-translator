// Each browser import decodes a string stored in the Rust module's memory.
export async function runBrowserWasm({ bytes, entry }) {
  const decoder = new globalThis.TextDecoder('utf-8', { fatal: true });
  const { instance } = await globalThis.WebAssembly.instantiate(
    new Uint8Array(bytes),
    {
      browser: {
        alert_utf8(pointer, length) {
          globalThis.alert(decode(pointer, length));
        },
        write_document_utf8(pointer, length) {
          globalThis.document.write(decode(pointer, length));
        },
      },
    }
  );
  function decode(pointer, length) {
    const text = new Uint8Array(
      instance.exports.memory.buffer,
      pointer,
      length
    );
    return decoder.decode(text);
  }
  instance.exports[entry]();
}
