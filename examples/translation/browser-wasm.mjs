// Browser imports exchange UTF-8 text through the Rust module's memory.
export async function runBrowserWasm({ bytes, entry }) {
  const decoder = new globalThis.TextDecoder('utf-8', { fatal: true });
  const encoder = new globalThis.TextEncoder();
  let response;
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
        prompt_utf8(pointer, length) {
          const answer = globalThis.prompt(decode(pointer, length), '');
          if (answer === null) {
            throw new Error('Expected a decimal response');
          }
          response = encoder.encode(answer);
          return response.length;
        },
        read_prompt_utf8(destination, length) {
          if (response?.length !== length) {
            throw new Error('Prompt response length does not match');
          }
          const buffer = new Uint8Array(
            instance.exports.memory.buffer,
            destination,
            length
          );
          buffer.set(response);
          response = undefined;
        },
        set_text_utf8(id, idLength, text, textLength) {
          globalThis.document.getElementById(decode(id, idLength)).textContent =
            decode(text, textLength);
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
