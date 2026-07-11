export class SoundManager {
    constructor(scene) {
        this.scene = scene;
        this.audioCtx = null;
        this.micStream = null;
        this.micAnalyser = null;
        this.micDataArray = null;
        this.init();
    }

    setScene(scene) {
        this.scene = scene;
        return this;
    }

    init() {
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
    }

    async initMic() {
        if (this.micStream) return true; // Already init
        if (!this.audioCtx) this.init();
        
        try {
            this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            this.micSource = this.audioCtx.createMediaStreamSource(this.micStream);
            this.micAnalyser = this.audioCtx.createAnalyser();
            this.micAnalyser.fftSize = 256;
            this.micSource.connect(this.micAnalyser);
            this.micDataArray = new Uint8Array(this.micAnalyser.frequencyBinCount);
            console.log("Microphone initialized for horror immersion.");
            return true;
        } catch (e) {
            console.warn("Microphone access denied or not available", e);
            return false;
        }
    }

    getMicVolume() {
        if (!this.micAnalyser || !this.micDataArray) return 0;
        this.micAnalyser.getByteFrequencyData(this.micDataArray);
        let sum = 0;
        for (let i = 0; i < this.micDataArray.length; i++) {
            sum += this.micDataArray[i];
        }
        // Return normalized 0-100 range roughly
        return (sum / this.micDataArray.length); 
    }

    stopMic() {
        if (this.micStream) {
            this.micStream.getTracks().forEach(track => track.stop());
            this.micStream = null;
            this.micAnalyser = null;
        }
    }

    playTone(freq, type, duration) {
        if (!this.audioCtx) return;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
        gain.gain.setValueAtTime(0.1, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start();
        osc.stop(this.audioCtx.currentTime + duration);
    }

    playNoise(duration) {
        if (!this.audioCtx) return;
        const bufferSize = this.audioCtx.sampleRate * duration;
        const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        const noise = this.audioCtx.createBufferSource();
        noise.buffer = buffer;
        const gain = this.audioCtx.createGain();
        gain.gain.setValueAtTime(0.05, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + duration);
        noise.connect(gain);
        gain.connect(this.audioCtx.destination);
        noise.start();
    }

    playFootstep() {
        if (!this.audioCtx) return;
        const t = this.audioCtx.currentTime;
        
        // Filtered noise for a "thud"
        const bufferSize = this.audioCtx.sampleRate * 0.1; // 100ms
        const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * 0.5;
        }

        const noise = this.audioCtx.createBufferSource();
        noise.buffer = buffer;

        // Lowpass filter for "thud"
        const filter = this.audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(150, t);

        const gain = this.audioCtx.createGain();
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.audioCtx.destination);
        noise.start();
    }

    playSpatialNoise(duration, x, y) {
        if (!this.audioCtx || !this.scene || !this.scene.player) return;
        
        const px = this.scene.player.sprite.x;
        const py = this.scene.player.sprite.y;
        
        // Calculate pan based on relative X position
        // Map width is usually ~800-1000. Let's normalize -1 to 1 over 400px distance
        let pan = (x - px) / 400;
        pan = Phaser.Math.Clamp(pan, -1, 1);
        
        // Calculate volume based on distance
        const dist = Phaser.Math.Distance.Between(px, py, x, y);
        let vol = 1 - (dist / 600); // 600px max hearing distance
        vol = Phaser.Math.Clamp(vol, 0, 1);
        
        if (vol <= 0) return;

        const bufferSize = this.audioCtx.sampleRate * duration;
        const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1);
        }

        const noise = this.audioCtx.createBufferSource();
        noise.buffer = buffer;

        // Stereo Panner
        const panner = this.audioCtx.createStereoPanner();
        panner.pan.setValueAtTime(pan, this.audioCtx.currentTime);

        const gain = this.audioCtx.createGain();
        gain.gain.setValueAtTime(vol * 0.1, this.audioCtx.currentTime); // Base volume 0.1
        gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + duration);

        noise.connect(panner);
        panner.connect(gain);
        gain.connect(this.audioCtx.destination);
        noise.start();
    }

    playHeartbeat(intensity = 1) {
        if (!this.audioCtx) return;
        const t = this.audioCtx.currentTime;
        
        // Lub
        const osc1 = this.audioCtx.createOscillator();
        const gain1 = this.audioCtx.createGain();
        osc1.frequency.setValueAtTime(60, t);
        osc1.frequency.exponentialRampToValueAtTime(40, t + 0.1);
        gain1.gain.setValueAtTime(0.5 * intensity, t);
        gain1.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
        osc1.connect(gain1);
        gain1.connect(this.audioCtx.destination);
        osc1.start(t);
        osc1.stop(t + 0.15);

        // Dub
        const osc2 = this.audioCtx.createOscillator();
        const gain2 = this.audioCtx.createGain();
        osc2.frequency.setValueAtTime(60, t + 0.2);
        osc2.frequency.exponentialRampToValueAtTime(40, t + 0.3);
        gain2.gain.setValueAtTime(0.4 * intensity, t + 0.2);
        gain2.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
        osc2.connect(gain2);
        gain2.connect(this.audioCtx.destination);
        osc2.start(t + 0.2);
        osc2.stop(t + 0.35);
    }

    playSpatialTone(freq, type, duration, sourceX, sourceY) {
        if (!this.audioCtx) return;
        
        // Calculate spatial values
        let pan = 0;
        let volume = 1;
        
        if (this.scene && this.scene.player && this.scene.player.sprite) {
            const px = this.scene.player.sprite.x;
            const py = this.scene.player.sprite.y;
            
            const dx = sourceX - px;
            const dy = sourceY - py;
            const dist = Math.sqrt(dx*dx + dy*dy);
            const maxDist = 600; // Hearable distance
            
            if (dist > maxDist) return; // Too far to hear
            
            pan = dx / 400; // Full pan at 400px
            if (pan < -1) pan = -1;
            if (pan > 1) pan = 1;
            
            volume = 1 - (dist / maxDist);
            if (volume < 0) volume = 0;
        }

        const osc = this.audioCtx.createOscillator();
        const panner = this.audioCtx.createStereoPanner();
        const gain = this.audioCtx.createGain();
        
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
        
        panner.pan.setValueAtTime(pan, this.audioCtx.currentTime);
        
        // Attack/Decay
        gain.gain.setValueAtTime(0.1 * volume, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01 * volume, this.audioCtx.currentTime + duration);
        
        osc.connect(panner);
        panner.connect(gain);
        gain.connect(this.audioCtx.destination);
        
        osc.start();
        osc.stop(this.audioCtx.currentTime + duration);
    }
}
