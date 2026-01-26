export class AudioRecorder {
  private audioCtx!: AudioContext;
  private worklet!: AudioWorkletNode;
  private stream!: MediaStream;

  async start(onData: (pcm: Float32Array) => void) {
    this.audioCtx = new AudioContext({ sampleRate: 16000 });

    await this.audioCtx.audioWorklet.addModule("/audio-worklet.js");

    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const source = this.audioCtx.createMediaStreamSource(this.stream);

    this.worklet = new AudioWorkletNode(this.audioCtx, "mic-processor");
    this.worklet.port.onmessage = (e) => onData(e.data);

    source.connect(this.worklet);
  }

  stop() {
    this.stream?.getTracks().forEach(t => t.stop());
    this.audioCtx?.close();
  }
}
