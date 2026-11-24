// The generated Rust module exports memory and show_alert. The imported
// function decodes its UTF-8 arguments before opening the browser dialog.
export async function showWasmAlert(bytes) {
  const decoder = new globalThis.TextDecoder('utf-8', { fatal: true });
  const { instance } = await globalThis.WebAssembly.instantiate(
    new Uint8Array(bytes),
    {
      browser: {
        alert_utf8(pointer, length) {
          const text = new Uint8Array(
            instance.exports.memory.buffer,
            pointer,
            length
          );
          globalThis.alert(decoder.decode(text));
        },
      },
    }
  );
  instance.exports.show_alert();
}
