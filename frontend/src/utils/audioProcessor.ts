export class AudioWorkletProcessor {
  audioContext: AudioContext | null = null;
  source: MediaStreamAudioSourceNode | null = null;
  processor: ScriptProcessorNode | null = null;
  stream: MediaStream | null = null;

  // AssemblyAI requires 16000Hz sample rate
  readonly targetSampleRate = 16000;
  
  async start(onAudioData: (data: Blob) => void) {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    // Create AudioContext with the target sample rate directly if supported
    // Otherwise we need to resample manually. 
    // Most modern browsers support setting sampleRate in AudioContext.
    this.audioContext = new window.AudioContext({ sampleRate: this.targetSampleRate });
    
    this.source = this.audioContext.createMediaStreamSource(this.stream);
    
    // Buffer size 4096 is a good balance between latency and performance
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

    this.source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);

    this.processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0); // Float32 array
      
      // Convert Float32 (browser default) to Int16 (PCM)
      const pcmData = this.floatTo16BitPCM(inputData);
      
      // Send raw bytes
      onAudioData(new Blob([pcmData]));
    };
  }

  stop() {
    this.stream?.getTracks().forEach(track => track.stop());
    this.processor?.disconnect();
    this.source?.disconnect();
    this.audioContext?.close();
    
    this.stream = null;
    this.processor = null;
    this.source = null;
    this.audioContext = null;
  }

  private floatTo16BitPCM(input: Float32Array): Int16Array {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return output;
  }
}