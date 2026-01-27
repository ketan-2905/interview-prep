class AudioInputProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 4096;
    this.buffer = new Float32Array(this.bufferSize);
    this.bytesWritten = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input && input.length > 0) {
      const channelData = input[0];
      
      // Fill internal buffer
      for (let i = 0; i < channelData.length; i++) {
        this.buffer[this.bytesWritten++] = channelData[i];
        
        // If buffer full, flush
        if (this.bytesWritten >= this.bufferSize) {
          this.port.postMessage(this.buffer.slice());
          this.bytesWritten = 0;
        }
      }
    }
    return true;
  }
}

registerProcessor('audio-input-processor', AudioInputProcessor);
