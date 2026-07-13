class AssetManager {
    constructor() {
        this.images = {};
        this.sounds = {};
        this.music_volume = 0.5;
        this.sound_volume = 0.5;
        this.current_music_index = 0;
        this.bg_index = 0;
        
        this.musicAudio = null;
        this.music_playing_pending = false;

        this.bg_files = ["bk.png", "bk1.png", "bk2.jpg", "bk3.jpg"];
        this.music_files = [];
        for (let i = 0; i < 10; i++) {
            this.music_files.push(resource_path(`assets/sounds/bkm${i === 0 ? '' : i}.mp3`));
        }
    }

    load_assets() {
        // Load images
        const imagePaths = {
            'head': "assets/images/snake_head.png",
            'body': "assets/images/snake_body.png",
            'tail': "assets/images/snake_tail.png",
            'food': "assets/images/food.png",
            'special_food': "assets/images/s food.png",
            'cut_food': "assets/images/cut.png",
            'obstacle': "assets/images/obstacle.png",
            
            'pu_slowmo': "assets/images/shepuslow.png",
            'pu_double': "assets/images/shepuduble.png",
            'pu_ghost': "assets/images/shepuinv.png",
            'pu_hack': "assets/images/shepuhack.png",
            'boss_img': "assets/images/shepuboss.png",

            'shepuf1': "assets/images/shepuf1.png",
            'shepuf2': "assets/images/shepuf2.png",
            'shepuf3': "assets/images/shepuf3.png",

            'background_raw': `assets/images/${this.bg_files[this.bg_index]}`,
            
            // Skins
            'head_dragon': "assets/images/snake_head_dragon.png",
            'body_dragon': "assets/images/snake_body_dragon.png",
            'tail_dragon': "assets/images/snake_tail_dragon.png",
            'head_robot': "assets/images/snake_head_robot.png",
            'body_robot': "assets/images/snake_body_robot.png",
            'tail_robot': "assets/images/snake_body_robot.png"
        };

        for (const [key, path] of Object.entries(imagePaths)) {
            const img = new Image();
            img.src = resource_path(path);
            this.images[key] = img;
        }

        if (Object.keys(this.sounds).length === 0) {
            const soundPaths = {
                'eat': "assets/sounds/gop.wav",
                'special_eat': "assets/sounds/s food.mp3",
                'cut': "assets/sounds/cut.mp3",
                'game_over': "assets/sounds/gameover.wav",
                'click': "assets/sounds/click.wav"
            };

            for (const [key, path] of Object.entries(soundPaths)) {
                try {
                    const audio = new Audio(resource_path(path));
                    audio.volume = this.sound_volume;
                    this.sounds[key] = audio;
                } catch (e) {
                    console.warn(`Could not load sound: ${key}`, e);
                    this.sounds[key] = { play: () => {}, set_volume: () => {} };
                }
            }
        }
    }

    play_music(index = null) {
        if (index !== null) {
            this.current_music_index = index;
        }
        
        try {
            this.stop_music();
            
            if (this.current_music_index >= 0 && this.current_music_index < this.music_files.length) {
                this.musicAudio = new Audio(this.music_files[this.current_music_index]);
                this.musicAudio.loop = true;
                this.musicAudio.volume = this.music_volume;
                
                this.musicAudio.play().catch(e => {
                    console.log("Autoplay prevented music playback, queued to resume on first click.");
                    this.music_playing_pending = true;
                });
            }
        } catch (e) {
            console.error("Failed playing music track:", e);
        }
    }

    resume_audio() {
        if (this.music_playing_pending && this.musicAudio) {
            this.musicAudio.play()
                .then(() => { this.music_playing_pending = false; })
                .catch(e => console.warn("Failed to resume audio context:", e));
        }
    }

    stop_music() {
        if (this.musicAudio) {
            try {
                this.musicAudio.pause();
                this.musicAudio = null;
            } catch (e) {}
        }
    }

    set_music_volume(volume) {
        this.music_volume = volume;
        if (this.musicAudio) {
            this.musicAudio.volume = volume;
        }
    }

    set_sound_volume(volume) {
        this.sound_volume = volume;
        for (const soundName in this.sounds) {
            const sound = this.sounds[soundName];
            if (sound && typeof sound.volume !== 'undefined') {
                sound.volume = volume;
            }
        }
    }

    play_sound(key) {
        const sound = this.sounds[key];
        if (sound) {
            try {
                sound.volume = this.sound_volume * (key === 'click' ? 1.4 : 1.0);
                sound.currentTime = 0;
                sound.play().catch(e => {
                    // Fallback to clone if direct play fails
                    try {
                        const clone = sound.cloneNode(true);
                        clone.volume = sound.volume;
                        clone.play().catch(() => {});
                    } catch (err) {}
                });
            } catch (e) {
                console.warn(`Failed playing sound: ${key}`, e);
            }
        }
    }
}
