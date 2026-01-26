class PCMProcessor extends AudioWorkletProcessor {
  floatTo16BitPCM(float32) {
    const buffer = new ArrayBuffer(float32.length * 2);
    const view = new DataView(buffer);
    let offset = 0;

    for (let i = 0; i < float32.length; i++, offset += 2) {
      let s = Math.max(-1, Math.min(1, float32[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return buffer;
  }

  process(inputs) {
    const input = inputs[0];
    if (input && input[0]) {
      const pcm = this.floatTo16BitPCM(input[0]);
      this.port.postMessage(pcm, [pcm]);
    }
    return true;
  }
}

registerProcessor("pcm-processor", PCMProcessor);
