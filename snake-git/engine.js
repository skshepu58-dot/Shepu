class GameEngine {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        
        this.running = true;
        this.last_time = performance.now();
        
        this.ui = new UIManager();
        this.data_manager = new DataManager();
        this.game_data = this.data_manager.load_data();
        
        config.FPS = this.game_data.fps || 10;
        config.STEP = this.game_data.step || 30;
        config.VISION_RADIUS = config.STEP * 6.5;
        this.game_mode = this.game_data.game_mode || 'Classic';
        
        this.assets = new AssetManager();
        this.assets.music_volume = this.game_data.music_volume !== undefined ? this.game_data.music_volume : 0.5;
        this.assets.sound_volume = this.game_data.sound_volume !== undefined ? this.game_data.sound_volume : 0.5;
        this.assets.current_music_index = this.game_data.music_index !== undefined ? this.game_data.music_index : Math.floor(Math.random() * 10);
        this.assets.bg_index = this.game_data.bg_index !== undefined ? this.game_data.bg_index : Math.floor(Math.random() * 4);
        
        this.assets.load_assets();
        this.assets.play_music();

        this.control_manager = new ControlManager(this.game_data);
        this.swipe_tutorial_timer = 0;
        this.use_touch_controls = is_android();

        this.splash = new CinematicIntro(config.WIDTH, config.HEIGHT, this.ui.font_large, this.ui.font_small);
        
        this.snake = new Snake();
        this.food = new Food("normal");
        this.special_food = new Food("special");
        this.cut_food = new Food("cut");
        this.power_up = new PowerUp();
        this.boss = new Boss();
        this.matrix_food = new MatrixFood();
        this.shepu_food = new ShepuFood();
        this.obstacles = [];
        
        this.matrix_active = false;
        this.matrix_timer = 0;
        this.matrix_chars = [];
        
        this.current_score = 0;
        this.start_time = 0;
        this.next_cut_food_score = config.CUT_FOOD_INTERVAL;
        this.level_up_message = "";
        this.level_up_message_time = 0;
        this.game_over_timer = 0;
        this.new_high_score = false;
        this.pause_start_time = 0;
        
        this.active_power_up = null;
        this.power_up_timer = 0;
        this.move_timer = 0;
        
        this.night_mode_active = false;
        this.night_timer = 0;
        this.night_event_delay = config.NIGHT_MODE_INTERVAL * 1000;
        this.night_alpha = 0;
        
        this.moving_event_active = false;
        this.moving_event_timer = 0;
        this.moving_event_delay = config.MOVING_OBSTACLE_INTERVAL * 1000;
        
        this.boss_battle_active = false;
        this.target_fps = 60;
        this.mouse_pos = [0, 0];
        
        this.state = "";
        this.init_html_ui();
        
        if (!this.game_data.player_name) {
            this.set_state("NAME_INPUT");
        } else {
            this.set_state("SPLASH");
        }
        
        this.bind_events();
    }

    _play_click() {
        this.assets.play_sound('click');
    }

    request_landscape() {
        try {
            if (screen.orientation && screen.orientation.lock) {
                screen.orientation.lock("landscape").catch(() => {});
            }
        } catch(e) {}
    }

    init_html_ui() {
        // Name Input
        document.getElementById("name-input-confirm").addEventListener("click", () => {
            this.confirm_name();
        });
        document.getElementById("name-input-field").addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                this.confirm_name();
            }
        });

        // Main Menu
        document.getElementById("menu-play").addEventListener("click", () => {
            this._play_click();
            this.request_landscape();
            if (!this.game_data.control_setup_done) {
                this.set_state("CONTROL_SELECT");
            } else {
                this._start_play_session();
            }
        });
        document.getElementById("menu-mode").addEventListener("click", () => {
            this._play_click();
            this.set_state("MODE");
        });
        document.getElementById("menu-skins").addEventListener("click", () => {
            this._play_click();
            this.set_state("SKINS");
        });
        document.getElementById("menu-high-score").addEventListener("click", () => {
            this._play_click();
            this.set_state("HIGH_SCORE");
        });
        document.getElementById("menu-settings").addEventListener("click", () => {
            this._play_click();
            this.set_state("SETTINGS");
        });
        document.getElementById("menu-support").addEventListener("click", () => {
            this._play_click();
            this.set_state("SUPPORT");
        });
        document.getElementById("menu-exit").addEventListener("click", () => {
            this._play_click();
            this.running = false;
            try {
                if (navigator.app && navigator.app.exitApp) {
                    navigator.app.exitApp();
                } else if (navigator.device && navigator.device.exitApp) {
                    navigator.device.exitApp();
                } else {
                    window.close();
                }
            } catch (e) {}
        });

        // Mode screen selection
        const bindModeCard = (modeName, elementId) => {
            document.getElementById(elementId).addEventListener("click", () => {
                this._play_click();
                this.game_mode = modeName;
                this.game_data.game_mode = modeName;
                this.data_manager.save_data(this.game_data);
                this.update_mode_selection_cards();
            });
        };
        bindModeCard("Classic", "mode-card-classic");
        bindModeCard("Time Attack", "mode-card-time-attack");
        bindModeCard("No Wall", "mode-card-no-wall");
        document.getElementById("mode-back").addEventListener("click", () => {
            this._play_click();
            this.set_state("MENU");
        });

        // Skin Shop selection
        const bindSkinButton = (skinName, buttonId) => {
            document.getElementById(buttonId).addEventListener("click", () => {
                const req = config.SKIN_UNLOCKS[skinName] || 0;
                if (this.game_data.lifetime_score >= req) {
                    this._play_click();
                    this.game_data.current_skin = skinName;
                    this.data_manager.save_data(this.game_data);
                    this.update_skin_shop_cards();
                } else {
                    this.ui.trigger_shake(8, 200);
                }
            });
        };
        bindSkinButton("classic", "skin-btn-classic");
        bindSkinButton("dragon", "skin-btn-dragon");
        bindSkinButton("robot", "skin-btn-robot");
        document.getElementById("skins-back").addEventListener("click", () => {
            this._play_click();
            this.set_state("MENU");
        });

        // Leaderboard dismiss
        document.getElementById("screen-high-score").addEventListener("click", () => {
            this._play_click();
            this.set_state("MENU");
        });

        // Support back button
        document.getElementById("support-back").addEventListener("click", () => {
            this._play_click();
            this.set_state("MENU");
        });

        // Settings adjustments
        document.getElementById("set-fps-minus").addEventListener("click", () => {
            config.FPS = Math.max(1, config.FPS - 1);
            this.game_data.fps = config.FPS;
            this.data_manager.save_data(this.game_data);
            this.update_settings_fields();
        });
        document.getElementById("set-fps-plus").addEventListener("click", () => {
            config.FPS = Math.min(20, config.FPS + 1);
            this.game_data.fps = config.FPS;
            this.data_manager.save_data(this.game_data);
            this.update_settings_fields();
        });
        document.getElementById("set-step-minus").addEventListener("click", () => {
            config.STEP = Math.max(10, config.STEP - 5);
            this.game_data.step = config.STEP;
            config.VISION_RADIUS = config.STEP * 6.5;
            this.assets.load_assets();
            this.data_manager.save_data(this.game_data);
            this.update_settings_fields();
        });
        document.getElementById("set-step-plus").addEventListener("click", () => {
            config.STEP = Math.min(60, config.STEP + 5);
            this.game_data.step = config.STEP;
            config.VISION_RADIUS = config.STEP * 6.5;
            this.assets.load_assets();
            this.data_manager.save_data(this.game_data);
            this.update_settings_fields();
        });
        
        const musicSlider = document.getElementById("slider-music");
        musicSlider.addEventListener("input", (e) => {
            this.assets.music_volume = parseFloat(e.target.value);
            this.assets.set_music_volume(this.assets.music_volume);
            this.game_data.music_volume = this.assets.music_volume;
        });
        musicSlider.addEventListener("change", () => {
            this.data_manager.save_data(this.game_data);
        });

        const soundSlider = document.getElementById("slider-sound");
        soundSlider.addEventListener("input", (e) => {
            this.assets.sound_volume = parseFloat(e.target.value);
            this.assets.set_sound_volume(this.assets.sound_volume);
            this.game_data.sound_volume = this.assets.sound_volume;
        });
        soundSlider.addEventListener("change", () => {
            this.data_manager.save_data(this.game_data);
        });

        document.getElementById("set-bg-effect").addEventListener("click", () => {
            this._play_click();
            this.game_data.bg_effect = !this.game_data.bg_effect;
            this.data_manager.save_data(this.game_data);
            this.update_settings_fields();
        });
        document.getElementById("set-bg-change").addEventListener("click", () => {
            this._play_click();
            this.assets.bg_index = (this.assets.bg_index + 1) % 4;
            this.assets.load_assets();
            this.game_data.bg_index = this.assets.bg_index;
            this.data_manager.save_data(this.game_data);
            this.update_settings_fields();
        });
        document.getElementById("set-control-mode").addEventListener("click", () => {
            this._play_click();
            this.control_manager.cycle_mode();
            this.game_data.control_mode = this.control_manager.mode;
            this.data_manager.save_data(this.game_data);
            this.update_settings_fields();
        });
        document.getElementById("set-joystick-side").addEventListener("click", () => {
            this._play_click();
            const side = (this.game_data.joystick_side || "right") === "right" ? "left" : "right";
            this.game_data.joystick_side = side;
            this.control_manager.set_mode(this.control_manager.mode, side);
            this.data_manager.save_data(this.game_data);
            this.update_settings_fields();
        });
        
        document.getElementById("set-track-prev").addEventListener("click", () => {
            this._play_click();
            this.assets.current_music_index = (this.assets.current_music_index - 1 + 10) % 10;
            this.assets.play_music();
            this.game_data.music_index = this.assets.current_music_index;
            this.data_manager.save_data(this.game_data);
            this.update_settings_fields();
        });
        document.getElementById("set-track-next").addEventListener("click", () => {
            this._play_click();
            this.assets.current_music_index = (this.assets.current_music_index + 1) % 10;
            this.assets.play_music();
            this.game_data.music_index = this.assets.current_music_index;
            this.data_manager.save_data(this.game_data);
            this.update_settings_fields();
        });
        document.getElementById("set-move-style").addEventListener("click", () => {
            this._play_click();
            const curr = this.game_data.movement_style || 'Robotic';
            const new_style = curr === "Robotic" ? "Realistic" : "Robotic";
            this.game_data.movement_style = new_style;
            this.data_manager.save_data(this.game_data);
            this.update_settings_fields();
        });
        
        document.getElementById("set-export").addEventListener("click", () => {
            this._play_click();
            export_data_to_file(this.game_data);
        });
        document.getElementById("set-import").addEventListener("click", () => {
            this._play_click();
            import_data_from_file((importedData) => {
                this.game_data = importedData;
                this.data_manager.save_data(this.game_data);
                
                config.FPS = this.game_data.fps;
                config.STEP = this.game_data.step;
                config.VISION_RADIUS = config.STEP * 6.5;
                this.game_mode = this.game_data.game_mode;
                
                this.assets.music_volume = this.game_data.music_volume;
                this.assets.sound_volume = this.game_data.sound_volume;
                this.assets.current_music_index = this.game_data.music_index;
                this.assets.bg_index = this.game_data.bg_index;
                
                this.assets.set_music_volume(this.assets.music_volume);
                this.assets.set_sound_volume(this.assets.sound_volume);
                this.assets.load_assets();
                this.assets.play_music();
                
                this.control_manager.set_mode(
                    this.game_data.control_mode,
                    this.game_data.joystick_side
                );
                
                this.update_settings_fields();
                this.ui.trigger_shake(8, 300);
            });
        });
        document.getElementById("settings-back").addEventListener("click", () => {
            this._play_click();
            this.set_state("MENU");
        });

        // Control Setup Opt-ins
        const bindControlOpt = (modeName, buttonId) => {
            document.getElementById(buttonId).addEventListener("click", () => {
                this._play_click();
                this.game_data.control_mode = modeName;
                this.game_data.control_setup_done = true;
                this.data_manager.save_data(this.game_data);
                this.control_manager.set_mode(modeName, this.game_data.joystick_side || "right");
                this._start_play_session();
            });
        };
        bindControlOpt(CONTROL_SWIPE, "control-opt-swipe");
        bindControlOpt(CONTROL_CORNER, "control-opt-corner");
        bindControlOpt(CONTROL_SPLIT, "control-opt-split");
        document.getElementById("control-select-back").addEventListener("click", () => {
            this._play_click();
            this.set_state("MENU");
        });

        // Pause Overlays
        document.getElementById("pause-resume").addEventListener("click", () => {
            this._play_click();
            this.set_state("PLAYING");
            this.start_time += (Date.now() - this.pause_start_time);
        });
        document.getElementById("pause-restart").addEventListener("click", () => {
            this._play_click();
            this.reset_game();
            this.set_state("PLAYING");
        });
        document.getElementById("pause-menu").addEventListener("click", () => {
            this._play_click();
            this.set_state("MENU");
        });

        // Game Over dismiss
        document.getElementById("screen-game-over").addEventListener("click", () => {
            this._play_click();
            this.set_state("MENU");
        });

        // Swipe Tutorial Skip
        document.getElementById("tutorial-skip-btn").addEventListener("click", () => {
            this._play_click();
            this.set_state("PLAYING");
        });
    }

    confirm_name() {
        const field = document.getElementById("name-input-field");
        const name = field.value.trim();
        if (name) {
            this.game_data.player_name = name.substring(0, 20);
            this.data_manager.save_data(this.game_data);
            this.set_state("SPLASH");
        } else {
            this.ui.trigger_shake(8, 200);
        }
    }

    set_state(new_state) {
        this.state = new_state;

        const overlay = document.getElementById("ui-overlay");
        const screens = document.querySelectorAll(".screen");
        screens.forEach(s => s.classList.add("hidden"));

        let targetId = null;
        if (new_state === "NAME_INPUT") targetId = "screen-name-input";
        else if (new_state === "MENU") targetId = "screen-menu";
        else if (new_state === "MODE") targetId = "screen-mode";
        else if (new_state === "SKINS") targetId = "screen-skins";
        else if (new_state === "HIGH_SCORE") targetId = "screen-high-score";
        else if (new_state === "SETTINGS") targetId = "screen-settings";
        else if (new_state === "SUPPORT") targetId = "screen-support";
        else if (new_state === "CONTROL_SELECT") targetId = "screen-control-select";
        else if (new_state === "PAUSED") targetId = "screen-paused";
        else if (new_state === "GAME_OVER") targetId = "screen-game-over";
        else if (new_state === "SWIPE_TUTORIAL") targetId = "screen-swipe-tutorial";

        if (targetId) {
            overlay.classList.remove("hidden");
            document.getElementById(targetId).classList.remove("hidden");
            this.on_screen_show(new_state);
        } else {
            overlay.classList.add("hidden");
        }
    }

    on_screen_show(state) {
        if (state === "MENU") {
            document.getElementById("menu-player-name").innerText = (this.game_data.player_name || "PLAYER").toUpperCase();
            document.getElementById("menu-avatar-initial").innerText = (this.game_data.player_name || "P").substring(0, 1).toUpperCase();
            document.getElementById("menu-level-label").innerText = `LEVEL ${this.game_data.level}`;
            
            let prog = 0;
            const nextScore = config.LEVEL_UP_SCORES[this.game_data.level + 1];
            if (nextScore !== undefined) {
                const prev = config.LEVEL_UP_SCORES[this.game_data.level] || 0;
                prog = Math.min(100, ((this.game_data.lifetime_score - prev) / (nextScore - prev)) * 100);
                document.getElementById("menu-xp-label").innerText = `${this.game_data.lifetime_score} / ${nextScore} XP`;
            } else {
                prog = 100;
                document.getElementById("menu-xp-label").innerText = `${this.game_data.lifetime_score} XP (MAX)`;
            }
            document.getElementById("menu-xp-bar").style.width = `${prog}%`;
        }
        else if (state === "MODE") {
            this.update_mode_selection_cards();
        }
        else if (state === "SKINS") {
            this.update_skin_shop_cards();
        }
        else if (state === "HIGH_SCORE") {
            document.getElementById("leaderboard-player").innerText = `* ${(this.game_data.player_name || "PLAYER").toUpperCase()} *`;
            document.getElementById("lb-score-classic").innerText = this.game_data.high_scores["Classic"] || 0;
            document.getElementById("lb-score-time-attack").innerText = this.game_data.high_scores["Time Attack"] || 0;
            document.getElementById("lb-score-no-wall").innerText = this.game_data.high_scores["No Wall"] || 0;
        }
        else if (state === "SETTINGS") {
            this.update_settings_fields();
        }
        else if (state === "PAUSED") {
            document.getElementById("paused-score-label").innerText = `SCORE: ${this.current_score}`;
        }
        else if (state === "GAME_OVER") {
            document.getElementById("go-score-val").innerText = `SCORE: ${this.current_score}`;
            const best = this.game_data.high_scores[this.game_mode] || 0;
            document.getElementById("go-best-val").innerText = `BEST: ${best}`;
            const newHighEl = document.getElementById("go-new-high");
            if (this.new_high_score) {
                newHighEl.classList.remove("hidden");
            } else {
                newHighEl.classList.add("hidden");
            }
        }
    }

    update_mode_selection_cards() {
        const modes = ["Classic", "Time Attack", "No Wall"];
        const ids = ["mode-card-classic", "mode-card-time-attack", "mode-card-no-wall"];
        for (let i = 0; i < modes.length; i++) {
            const card = document.getElementById(ids[i]);
            if (this.game_mode === modes[i]) {
                card.classList.add("active-mode");
            } else {
                card.classList.remove("active-mode");
            }
        }
    }

    update_skin_shop_cards() {
        const skins = ["classic", "dragon", "robot"];
        const cardIds = ["skin-card-classic", "skin-card-dragon", "skin-card-robot"];
        const btnIds = ["skin-btn-classic", "skin-btn-dragon", "skin-btn-robot"];
        
        for (let i = 0; i < skins.length; i++) {
            const skin = skins[i];
            const card = document.getElementById(cardIds[i]);
            const btn = document.getElementById(btnIds[i]);
            const req = config.SKIN_UNLOCKS[skin] || 0;
            const unlocked = this.game_data.lifetime_score >= req;
            
            if (this.game_data.current_skin === skin) {
                card.classList.add("active-skin");
                btn.innerText = "EQUIPPED";
                btn.style.color = "#00ffd2";
                btn.style.borderColor = "#00ffd2";
            } else {
                card.classList.remove("active-skin");
                if (unlocked) {
                    btn.innerText = "EQUIP";
                    btn.style.color = "#00bcff";
                    btn.style.borderColor = "#005f8f";
                } else {
                    btn.innerText = `LOCK ${req} XP`;
                    btn.style.color = "#888";
                    btn.style.borderColor = "#444";
                }
            }
        }
    }

    update_settings_fields() {
        document.getElementById("val-fps").innerText = config.FPS;
        document.getElementById("val-step").innerText = config.STEP;
        
        const effectBtn = document.getElementById("set-bg-effect");
        effectBtn.innerText = `BG TINT: ${this.game_data.bg_effect ? 'ON' : 'OFF'}`;
        effectBtn.style.color = this.game_data.bg_effect ? "#00ffd2" : "#ff4a4a";
        effectBtn.style.borderColor = this.game_data.bg_effect ? "#00ffd2" : "#ff4a4a";

        document.getElementById("set-bg-change").innerText = `BG: ${this.assets.bg_index + 1}`;
        
        const modeLabel = CONTROL_LABELS[this.game_data.control_mode] || this.game_data.control_mode.toUpperCase();
        document.getElementById("set-control-mode").innerText = `CONTROL: ${modeLabel}`;
        
        document.getElementById("set-joystick-side").innerText = `JOY SIDE: ${(this.game_data.joystick_side || "right").toUpperCase()}`;
        document.getElementById("set-track-val").innerText = this.assets.current_music_index + 1;
        
        document.getElementById("set-move-style").innerText = `STYLE: ${(this.game_data.movement_style || 'Robotic').toUpperCase()}`;
        
        document.getElementById("slider-music").value = this.assets.music_volume;
        document.getElementById("slider-sound").value = this.assets.sound_volume;
    }

    _start_play_session() {
        this.reset_game();
        const mode = this.game_data.control_mode || CONTROL_SWIPE;
        this.control_manager.set_mode(
            mode,
            this.game_data.joystick_side || "right"
        );
        
        // Show swipe.png ONLY ONCE in the player's lifetime
        if (mode === CONTROL_SWIPE && !this.game_data.swipe_tutorial_shown) {
            this.set_state("SWIPE_TUTORIAL");
            this.swipe_tutorial_timer = 2000;
            this.game_data.swipe_tutorial_shown = true;
            this.data_manager.save_data(this.game_data);
        } else {
            this.set_state("PLAYING");
        }
    }

    _select_control_mode(mode) {
        this.game_data.control_mode = mode;
        this.game_data.control_setup_done = true;
        this.data_manager.save_data(this.game_data);
        this.control_manager.set_mode(mode, this.game_data.joystick_side || "right");
        this._start_play_session();
    }

    reset_game() {
        this.snake.reset();
        this.spawn_obstacles();
        this.food.spawn(this.snake.body.concat(this.obstacles.map(o => o.pos)));
        this.special_food.active = false;
        this.cut_food.active = false;
        this.power_up.active_on_field = false;
        this.active_power_up = null;
        this.power_up_timer = 0;
        this.power_up_max_timer = config.POWER_UP_DURATION * 1000;
        this.current_score = 0;
        this.start_time = Date.now();
        this.next_cut_food_score = config.CUT_FOOD_INTERVAL;
        this.move_timer = 0;
        this.night_mode_active = false;
        this.night_timer = 0;
        this.night_event_delay = config.NIGHT_MODE_INTERVAL * 1000;
        this.night_alpha = 0;
        this.moving_event_active = false;
        this.moving_event_timer = 0;
        this.moving_event_delay = config.MOVING_OBSTACLE_INTERVAL * 1000;
        this.boss_battle_active = false;
        this.matrix_active = false;
        this.matrix_timer = 0;
        this.matrix_chars = [];
        this.matrix_food.active = false;
        this.shepu_food.active = false;
        this.boss.active = false;
        this.new_high_score = false;
        
        this.assets.play_music();
    }

    spawn_obstacles() {
        this.obstacles = [];
        if (this.game_mode === "No Wall") {
            return;
        }
        
        const num_obstacles = Math.max(0, (this.game_data.level - 1) * config.OBSTACLE_COUNT_PER_LEVEL);
        for (let i = 0; i < num_obstacles; i++) {
            const pos = find_spawn_position(this.snake.body, this.obstacles.map(o => o.pos));
            if (!this.obstacles.some(o => o.pos[0] === pos[0] && o.pos[1] === pos[1])) {
                this.obstacles.push(new Obstacle(pos, false));
            }
        }
    }

    bind_events() {
        const triggerLock = () => {
            this.request_landscape();
            this.assets.resume_audio();
        };
        document.body.addEventListener("touchstart", triggerLock, { once: true });
        document.body.addEventListener("click", triggerLock, { once: true });

        // Native Back Button and Escape Key Handling
        const handleBackAction = () => {
            if (this.state === "PLAYING") {
                this.pause_game();
            } else if (this.state === "PAUSED") {
                this.resume_game();
            } else if (this.state === "MENU" || this.state === "NAME_INPUT") {
                try {
                    if (navigator.app && navigator.app.exitApp) {
                        navigator.app.exitApp();
                    }
                } catch(e) {}
            } else {
                this.set_state("MENU");
            }
        };

        document.addEventListener("backbutton", (e) => {
            e.preventDefault();
            handleBackAction();
        }, false);

        window.addEventListener("keydown", (e) => {
            if (e.key === "Escape" || e.key === "Backspace") {
                if (this.state === "NAME_INPUT" && document.activeElement === document.getElementById("name-input-field")) {
                    return; 
                }
                e.preventDefault();
                handleBackAction();
            }
        });

        const mapCoords = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            return [
                (clientX - rect.left) * (config.WIDTH / rect.width),
                (clientY - rect.top) * (config.HEIGHT / rect.height)
            ];
        };

        this.canvas.addEventListener("mousemove", (e) => {
            this.mouse_pos = mapCoords(e);
        });

        this.canvas.addEventListener("mousedown", (e) => {
            if (e.button !== 0) return;
            const pos = mapCoords(e);
            
            if (this.state === "PLAYING" || this.state === "SWIPE_TUTORIAL") {
                this.control_manager.handleInputStart(pos[0], pos[1], 0, this.state);
            }
        });

        this.canvas.addEventListener("touchstart", (e) => {
            e.preventDefault();
            this.assets.resume_audio();
            
            for (const touch of e.changedTouches) {
                const pos = [
                    (touch.clientX - this.canvas.getBoundingClientRect().left) * (config.WIDTH / this.canvas.getBoundingClientRect().width),
                    (touch.clientY - this.canvas.getBoundingClientRect().top) * (config.HEIGHT / this.canvas.getBoundingClientRect().height)
                ];
                
                if (this.state === "PLAYING" || this.state === "SWIPE_TUTORIAL") {
                    this.control_manager.handleInputStart(pos[0], pos[1], touch.identifier, this.state);
                }
                this.mouse_pos = pos;
            }
        }, { passive: false });

        this.canvas.addEventListener("touchmove", (e) => {
            e.preventDefault();
            for (const touch of e.changedTouches) {
                const pos = [
                    (touch.clientX - this.canvas.getBoundingClientRect().left) * (config.WIDTH / this.canvas.getBoundingClientRect().width),
                    (touch.clientY - this.canvas.getBoundingClientRect().top) * (config.HEIGHT / this.canvas.getBoundingClientRect().height)
                ];
                this.control_manager.handleInputMove(pos[0], pos[1], touch.identifier, this.state);
            }
        }, { passive: false });

        this.canvas.addEventListener("touchend", (e) => {
            e.preventDefault();
            for (const touch of e.changedTouches) {
                const pos = [
                    (touch.clientX - this.canvas.getBoundingClientRect().left) * (config.WIDTH / this.canvas.getBoundingClientRect().width),
                    (touch.clientY - this.canvas.getBoundingClientRect().top) * (config.HEIGHT / this.canvas.getBoundingClientRect().height)
                ];
                this.control_manager.handleInputEnd(pos[0], pos[1], touch.identifier, this.state);
            }
        }, { passive: false });

        window.addEventListener("keydown", (e) => {
            this.assets.resume_audio();
            const key = e.key;

            if (this.state === "PLAYING") {
                if (key === "Escape" || key === "p" || key === "P") {
                    this.set_state("PAUSED");
                    this.pause_start_time = Date.now();
                } else {
                    this.snake.handle_input(key);
                }
            }
        });
    }

    update(dt) {
        this.ui.update_effects(dt);
        
        if (this.state !== "PLAYING" && this.state !== "SWIPE_TUTORIAL" && this.state !== "SPLASH" && this.state !== "GAME_OVER") return;

        if (this.state === "SWIPE_TUTORIAL") {
            this.swipe_tutorial_timer -= dt;
            const direction = this.control_manager.consume_direction();
            if (direction) {
                this.snake.queue_direction(direction);
            }
            if (this.swipe_tutorial_timer <= 0) {
                this.set_state("PLAYING");
            }
            return;
        }

        if (this.state === "SPLASH") {
            this.splash.update(dt);
            if (this.splash.done) {
                this.set_state("MENU");
            }
            return;
        }

        if (this.state === "GAME_OVER") {
            this.game_over_timer -= dt;
            if (this.game_over_timer <= 0) {
                this.set_state("MENU");
            }
            return;
        }

        const direction = this.control_manager.consume_direction();
        if (direction) {
            this.snake.queue_direction(direction);
        }

        if (this.matrix_active) {
            this.matrix_timer -= dt;
            if (this.matrix_timer <= 0) this.matrix_active = false;
        }
        
        if (this.matrix_food.active) {
            if (Date.now() - this.matrix_food.spawn_time > config.MATRIX_FOOD_LIFETIME * 1000) {
                this.matrix_food.active = false;
            }
        }

        if (this.active_power_up) {
            this.power_up_timer -= dt;
            if (this.power_up_timer <= 0) this.active_power_up = null;
        }

        if (this.boss.active) {
            this.boss.update(dt, this.snake.pos);
        }

        for (const o of this.obstacles) o.update();

        const speed_mult = this.active_power_up === "slowmo" ? 0.5 : 1.0;
        const move_delay = (1000 / config.FPS) / speed_mult;
        this.move_timer += dt;
        
        if (this.move_timer >= move_delay) {
            this.move_timer -= move_delay;
            this.move_snake();
            this.check_level_up();
        }

        if (this.game_data.level >= config.NIGHT_MODE_START_LEVEL && !this.boss_battle_active) {
            if (!this.night_mode_active) {
                this.night_event_delay -= dt;
                if (this.night_event_delay <= 0) {
                    this.night_mode_active = true;
                    this.night_timer = config.NIGHT_MODE_DURATION * 1000;
                }
            } else {
                this.night_timer -= dt;
                if (this.night_timer <= 0) {
                    this.night_mode_active = false;
                    this.night_event_delay = config.NIGHT_MODE_INTERVAL * 1000;
                }
            }
        }
        
        if (this.night_mode_active) this.night_alpha = Math.min(245, this.night_alpha + 5);
        else this.night_alpha = Math.max(0, this.night_alpha - 5);

        if (this.game_data.level >= config.MOVING_OBSTACLE_START_LEVEL && !this.boss_battle_active) {
            if (!this.moving_event_active) {
                this.moving_event_delay -= dt;
                if (this.moving_event_delay <= 0) {
                    this.moving_event_active = true;
                    this.moving_event_timer = config.MOVING_OBSTACLE_DURATION * 1000;
                    for (const o of this.obstacles) {
                        o.moving = true;
                        o.vx = Math.random() < 0.5 ? -2 : 2;
                        o.vy = Math.random() < 0.5 ? -2 : 2;
                    }
                }
            } else {
                this.moving_event_timer -= dt;
                if (this.moving_event_timer <= 0) {
                    this.moving_event_active = false;
                    this.moving_event_delay = config.MOVING_OBSTACLE_INTERVAL * 1000;
                    for (const o of this.obstacles) {
                        o.moving = false;
                    }
                }
            }
        }

        if (this.boss_battle_active) {
            const s = config.STEP;
            const br = {
                x: this.boss.pos[0] - s,
                y: this.boss.pos[1] - s,
                w: s * 2,
                h: s * 2
            };
            const sr = {
                x: this.snake.pos[0],
                y: this.snake.pos[1],
                w: s,
                h: s
            };

            const overlaps = !(sr.x + sr.w <= br.x || sr.x >= br.x + br.w || sr.y + sr.h <= br.y || sr.y >= br.y + br.h);
            if (overlaps && this.active_power_up !== "ghost") {
                this.game_over();
                return;
            }
        }

        if (this.game_mode === "Time Attack") {
            const timeElapsed = (Date.now() - this.start_time) / 1000;
            if (config.TIME_ATTACK_DURATION - timeElapsed <= 0) {
                this.game_over();
                return;
            }
        }
    }

    move_snake() {
        let grow = false;
        const s = config.STEP;

        const checkOverlap = (pos1, pos2, sizeMult = 1.0) => {
            const sz = Math.floor(s * sizeMult);
            const r1 = { x: pos1[0], y: pos1[1], w: s, h: s };
            const offset = Math.floor((sz - s) / 2);
            const r2 = { x: pos2[0] - offset, y: pos2[1] - offset, w: sz, h: sz };
            return !(r1.x + r1.w <= r2.x || r1.x >= r2.x + r2.w || r1.y + r1.h <= r2.y || r1.y >= r2.y + r2.h);
        };

        if (checkOverlap(this.snake.pos, this.food.pos)) {
            this.assets.play_sound('eat');
            let gain = 10;
            if (this.active_power_up === "double") gain *= 2;
            
            this.current_score += gain;
            this.game_data.lifetime_score += gain;

            this.ui.create_particles(this.food.pos[0] + s/2, this.food.pos[1] + s/2, config.WHITE);
            this.food.spawn(this.snake.body.concat(this.obstacles.map(o => o.pos)));
            grow = true;
            this.check_level_up();

            const sp_chance = this.boss_battle_active ? 0.5 : config.SPECIAL_FOOD_SPAWN_CHANCE;
            if (!this.special_food.active && Math.random() < sp_chance) {
                this.special_food.spawn(this.snake.body.concat(this.obstacles.map(o => o.pos)));
            }

            if (!this.shepu_food.active && Math.random() < config.SHEPU_FOOD_SPAWN_CHANCE) {
                this.shepu_food.spawn(this.snake.body, this.obstacles);
            }

            if (!this.power_up.active_on_field && !this.active_power_up && Math.random() < config.POWER_UP_SPAWN_CHANCE) {
                this.power_up.type = config.POWER_UP_TYPES[Math.floor(Math.random() * config.POWER_UP_TYPES.length)];
                this.power_up.spawn(this.snake.body, this.obstacles);
            }
        }

        if (this.special_food.active) {
            if (checkOverlap(this.snake.pos, this.special_food.pos)) {
                this.assets.play_sound('special_eat');
                let gain = 20;
                if (this.active_power_up === "double") gain *= 2;

                this.current_score += gain;
                this.game_data.lifetime_score += gain;

                this.ui.create_particles(this.special_food.pos[0] + s/2, this.special_food.pos[1] + s/2, config.GREEN);
                this.ui.trigger_shake(8, 300);
                this.special_food.active = false;

                if (this.boss_battle_active) {
                    this.boss.health -= 1;
                    if (this.boss.health <= 0) {
                        this.defeat_boss();
                    }
                } else {
                    this.check_level_up();
                }
            } else if (Date.now() - this.special_food.spawn_time > config.SPECIAL_FOOD_DURATION * 1000) {
                this.special_food.active = false;
            }
        }

        if (this.shepu_food.active) {
            if (checkOverlap(this.snake.pos, this.shepu_food.pos, 1.2)) {
                this.assets.play_sound('eat');
                let gain = config.SHEPU_FOOD_POINTS;
                if (this.active_power_up === "double") gain *= 2;

                this.current_score += gain;
                this.game_data.lifetime_score += gain;

                this.ui.create_particles(this.shepu_food.pos[0] + s/2, this.shepu_food.pos[1] + s/2, config.GOLD);
                this.ui.trigger_shake(5, 200);
                this.shepu_food.active = false;
                this.check_level_up();
            } else if (Date.now() - this.shepu_food.spawn_time > config.SHEPU_FOOD_DURATION * 1000) {
                this.shepu_food.active = false;
            }
        }

        if (this.power_up.active_on_field) {
            if (checkOverlap(this.snake.pos, this.power_up.pos, 1.4)) {
                this.active_power_up = this.power_up.type;
                this.power_up_timer = config.POWER_UP_DURATION * 1000;
                this.power_up_max_timer = this.power_up_timer;
                this.power_up.active_on_field = false;

                this.ui.trigger_shake(5, 150);
                this.ui.create_particles(this.power_up.pos[0] + s/2, this.power_up.pos[1] + s/2, config.CYAN);
            } else if (Date.now() - this.power_up.spawn_time > 10000) {
                this.power_up.active_on_field = false;
            }
        }

        if (this.current_score >= this.next_cut_food_score && !this.cut_food.active) {
            this.cut_food.spawn(this.snake.body.concat(this.obstacles.map(o => o.pos)));
        }

        if (this.cut_food.active) {
            if (checkOverlap(this.snake.pos, this.cut_food.pos)) {
                this.assets.play_sound('cut');
                this.ui.create_particles(this.cut_food.pos[0] + s/2, this.cut_food.pos[1] + s/2, config.BLUE);
                this.cut_food.active = false;
                this.next_cut_food_score += config.CUT_FOOD_INTERVAL;
                if (this.snake.body.length > 2) {
                    this.snake.body.splice(-2);
                }
            } else if (Date.now() - this.cut_food.spawn_time > config.CUT_FOOD_DURATION * 1000) {
                this.cut_food.active = false;
                this.next_cut_food_score += config.CUT_FOOD_INTERVAL;
            }
        }

        if (!this.matrix_food.active && !this.matrix_active && Math.random() < config.MATRIX_FOOD_SPAWN_CHANCE) {
            this.matrix_food.spawn(this.snake.body, this.obstacles.concat([this.food, this.special_food]));
        }

        if (this.matrix_food.active) {
            if (checkOverlap(this.snake.pos, this.matrix_food.pos)) {
                this.matrix_active = true;
                this.matrix_timer = config.MATRIX_EFFECT_DURATION * 1000;
                this.matrix_food.active = false;
                
                this.assets.play_sound('special_eat');
                this.ui.trigger_shake(12, 400);

                this.matrix_chars = [];
                for (let i = 0; i < 100; i++) {
                    this.matrix_chars.push({
                        x: Math.floor(Math.random() * config.WIDTH),
                        y: Math.floor(Math.random() * config.HEIGHT),
                        char: ['0', '1', '@'][Math.floor(Math.random() * 3)],
                        speed: Math.floor(Math.random() * 5) + 2
                    });
                }
            }
        }

        this.snake.move(grow);

        const ghost = this.active_power_up === "ghost";
        if (this.snake.check_collision(this.game_mode, ghost)) {
            this.game_over();
            return;
        }

        if (!ghost) {
            for (const o of this.obstacles) {
                if (checkOverlap(this.snake.pos, o.pos)) {
                    this.game_over();
                    return;
                }
            }
        }
    }

    check_level_up() {
        const lvl = this.game_data.level;
        if (config.LEVEL_UP_SCORES[lvl + 1] !== undefined && this.game_data.lifetime_score >= config.LEVEL_UP_SCORES[lvl + 1]) {
            this.game_data.level += 1;
            if (this.game_data.level % config.BOSS_LEVEL_INTERVAL === 0) {
                this.start_boss_battle();
            } else {
                this.level_up_message = `LEVEL ${this.game_data.level} UNLOCKED!`;
                this.level_up_message_time = Date.now();
                this.data_manager.save_data(this.game_data);
                this.spawn_obstacles();
            }
        }
    }

    start_boss_battle() {
        this.boss_battle_active = true;
        this.boss.reset(this.game_data.level);
        this.boss.active = true;
        this.obstacles = [];
        this.level_up_message = `BOSS FIGHT LV${this.game_data.level}!`;
        this.level_up_message_time = Date.now();
        this.ui.trigger_shake(20, 1000);
    }

    defeat_boss() {
        this.boss_battle_active = false;
        this.boss.active = false;
        this.current_score += 100;
        this.game_data.lifetime_score += 100;
        this.level_up_message = "BOSS DEFEATED! +100 XP";
        this.level_up_message_time = Date.now();
        this.data_manager.save_data(this.game_data);
        this.spawn_obstacles();
        this.ui.trigger_shake(15, 500);
    }

    game_over() {
        this.set_state("GAME_OVER");
        this.game_over_timer = 3000;
        this.ui.trigger_shake(15, 500);
        this.assets.stop_music();
        this.assets.play_sound('game_over');

        const prev_best = this.game_data.high_scores[this.game_mode] || 0;
        if (this.current_score > prev_best) {
            this.game_data.high_scores[this.game_mode] = this.current_score;
            this.new_high_score = true;
        }
        this.data_manager.save_data(this.game_data);
    }

    draw() {
        const ctx = this.ctx;
        const shake = this.ui.get_shake_offset();
        
        ctx.fillStyle = config.BLACK;
        ctx.fillRect(0, 0, config.WIDTH, config.HEIGHT);

        const skip_menu_bg = (this.state === "PLAYING" || this.state === "PAUSED" || this.state === "SWIPE_TUTORIAL");
        
        if (!skip_menu_bg) {
            const bg = this.assets.images['background_raw'];
            if (bg && bg.complete) {
                ctx.save();
                const imgRatio = bg.width / bg.height;
                const screenRatio = config.WIDTH / config.HEIGHT;
                let sw, sh, sx, sy;
                if (screenRatio > imgRatio) {
                    sw = bg.width;
                    sh = bg.width / screenRatio;
                    sx = 0;
                    sy = (bg.height - sh) / 2;
                } else {
                    sh = bg.height;
                    sw = bg.height * screenRatio;
                    sx = (bg.width - sw) / 2;
                    sy = 0;
                }
                ctx.drawImage(bg, sx, sy, sw, sh, 0, 0, config.WIDTH, config.HEIGHT);
                
                if (this.game_data.bg_effect) {
                    ctx.fillStyle = "rgba(20, 20, 40, 0.6)";
                    ctx.fillRect(0, 0, config.WIDTH, config.HEIGHT);
                }
                ctx.restore();
            }
        }

        if (this.state === "SPLASH") {
            this.splash.draw(ctx, config.WIDTH, config.HEIGHT);
        }
        else if (this.state === "PLAYING" || this.state === "PAUSED" || this.state === "SWIPE_TUTORIAL") {
            const pa = this.control_manager.play_area;
            const play_rect = pa.game_rect();
            const bg = this.assets.images['background_raw'];
            
            ctx.save();
            ctx.beginPath();
            ctx.rect(play_rect.x, play_rect.y, play_rect.w, play_rect.h);
            ctx.clip();

            if (bg && bg.complete) {
                const imgRatio = bg.width / bg.height;
                let sw, sh, sx, sy;
                
                if (pa.control_mode === CONTROL_SPLIT) {
                    const screenRatio = pa.play_w / pa.play_h;
                    if (screenRatio > imgRatio) {
                        sw = bg.width;
                        sh = bg.width / screenRatio;
                        sx = 0;
                        sy = (bg.height - sh) / 2;
                    } else {
                        sh = bg.height;
                        sw = bg.height * screenRatio;
                        sx = (bg.width - sw) / 2;
                        sy = 0;
                    }
                    ctx.drawImage(bg, sx, sy, sw, sh, pa.offset_x, pa.offset_y, pa.play_w, pa.play_h);
                } else {
                    const screenRatio = config.WIDTH / config.HEIGHT;
                    if (screenRatio > imgRatio) {
                        sw = bg.width;
                        sh = bg.width / screenRatio;
                        sx = 0;
                        sy = (bg.height - sh) / 2;
                    } else {
                        sh = bg.height;
                        sw = bg.height * screenRatio;
                        sx = (bg.width - sw) / 2;
                        sy = 0;
                    }
                    ctx.drawImage(bg, sx, sy, sw, sh, 0, 0, config.WIDTH, config.HEIGHT);
                }
                
                if (this.game_data.bg_effect) {
                    ctx.fillStyle = "rgba(20, 20, 40, 0.6)";
                    ctx.fillRect(play_rect.x, play_rect.y, play_rect.w, play_rect.h);
                }
            }

            const speed_mult = this.active_power_up === "slowmo" ? 0.5 : 1.0;
            const move_delay = (1000 / config.FPS) / speed_mult;
            const interp = Math.min(1.0, this.move_timer / move_delay);

            for (const o of this.obstacles) {
                o.draw(ctx, this.assets, shake);
            }

            this.snake.draw(ctx, this.assets, this.game_data.current_skin, shake, interp, this.game_data.movement_style || 'Robotic');

            const food_img = this.assets.images['food'];
            const s = config.STEP;
            if (food_img && food_img.complete) {
                ctx.drawImage(food_img, this.food.pos[0] + shake[0], this.food.pos[1] + shake[1], s, s);
            } else {
                ctx.fillStyle = config.RED;
                ctx.fillRect(this.food.pos[0] + shake[0], this.food.pos[1] + shake[1], s, s);
            }

            if (this.special_food.active) {
                const s_food_img = this.assets.images['special_food'];
                if (s_food_img && s_food_img.complete) {
                    ctx.drawImage(s_food_img, this.special_food.pos[0] + shake[0], this.special_food.pos[1] + shake[1], s, s);
                } else {
                    ctx.fillStyle = config.GREEN;
                    ctx.fillRect(this.special_food.pos[0] + shake[0], this.special_food.pos[1] + shake[1], s, s);
                }
            }

            if (this.shepu_food.active) {
                this.shepu_food.draw(ctx, this.assets, shake);
            }

            if (this.matrix_food.active) {
                this.matrix_food.draw(ctx, this.assets, shake);
            }

            if (this.cut_food.active) {
                const cut_img = this.assets.images['cut_food'];
                if (cut_img && cut_img.complete) {
                    ctx.drawImage(cut_img, this.cut_food.pos[0] + shake[0], this.cut_food.pos[1] + shake[1], s, s);
                } else {
                    ctx.fillStyle = config.BLUE;
                    ctx.fillRect(this.cut_food.pos[0] + shake[0], this.cut_food.pos[1] + shake[1], s, s);
                }
            }

            if (this.matrix_active) {
                ctx.fillStyle = "rgba(0, 0, 0, 0.63)";
                ctx.fillRect(0, 0, config.WIDTH, config.HEIGHT);
                
                ctx.font = this.ui.font_num_tiny;
                ctx.fillStyle = "rgb(0, 255, 70)";
                ctx.textAlign = "center";
                for (const c of this.matrix_chars) {
                    c.y = (c.y + c.speed) % config.HEIGHT;
                    ctx.fillText(c.char, c.x, c.y);
                }
                
                if (Math.floor(Date.now() / 250) % 2 === 0) {
                    this.ui.draw_text(ctx, "SYSTEM HACKED - MATRIX MODE", this.ui.font_small, "rgb(0, 255, 0)", config.WIDTH / 2, 110, true, false);
                }
            }

            if (this.power_up.active_on_field) {
                this.power_up.draw(ctx, this.assets, shake);
            }

            if (this.boss.active) {
                this.boss.draw(ctx, this.assets, shake);
            }

            if (this.night_alpha > 0) {
                ctx.save();
                const hx = this.snake.pos[0] + config.STEP / 2 + shake[0];
                const hy = this.snake.pos[1] + config.STEP / 2 + shake[1];
                const vr = config.VISION_RADIUS;
                
                ctx.fillStyle = `rgba(0, 0, 0, ${this.night_alpha / 255})`;
                
                const maskCanvas = document.createElement("canvas");
                maskCanvas.width = config.WIDTH;
                maskCanvas.height = config.HEIGHT;
                const mctx = maskCanvas.getContext("2d");
                
                mctx.fillStyle = `rgba(0, 0, 0, ${this.night_alpha / 255})`;
                mctx.fillRect(0, 0, config.WIDTH, config.HEIGHT);
                
                mctx.globalCompositeOperation = 'destination-out';
                const grad = mctx.createRadialGradient(hx, hy, 0, hx, hy, vr);
                grad.addColorStop(0, "rgba(0,0,0,1)");
                grad.addColorStop(0.8, "rgba(0,0,0,0.4)");
                grad.addColorStop(1, "rgba(0,0,0,0)");
                mctx.fillStyle = grad;
                mctx.beginPath();
                mctx.arc(hx, hy, vr, 0, Math.PI * 2);
                mctx.fill();
                
                ctx.drawImage(maskCanvas, 0, 0);
                ctx.restore();
            }

            this.ui.draw_text(ctx, `SCORE: ${this.current_score}`, this.ui.font_num_small, config.WHITE, config.WIDTH - 20, 40 + shake[1], false, true, "right");
            this.ui.draw_level_info(ctx, this.game_data.level, this.game_data.lifetime_score, config.LEVEL_UP_SCORES[this.game_data.level + 1] || 'MAX');
            
            if (this.game_mode === "Time Attack") {
                const tl = Math.max(0, config.TIME_ATTACK_DURATION - (Date.now() - (this.state === "PLAYING" ? this.start_time : this.pause_start_time)) / 1000);
                this.ui.draw_text(ctx, `TIME: ${Math.floor(tl)}s`, this.ui.font_num_mid, config.RED, config.WIDTH / 2, 40);
            }

            if (Date.now() - this.level_up_message_time < 3000) {
                this.ui.draw_text(ctx, this.level_up_message, this.ui.font_small, config.GOLD, config.WIDTH / 2, 160);
            }
            if (this.boss_battle_active) {
                this.ui.draw_text(ctx, `BOSS HP: ${this.boss.health}`, this.ui.font_num_mid, config.RED, config.WIDTH / 2, config.HEIGHT - 50);
            }
            if (this.moving_event_active) {
                this.ui.draw_text(ctx, `STORM: ${Math.floor(this.moving_event_timer / 1000)}s`, this.ui.font_num_tiny, config.RED, config.WIDTH / 2, 60);
            }
            
            if (this.active_power_up) {
                const c = this.active_power_up === "slowmo" ? config.CYAN : (this.active_power_up === "ghost" ? config.PURPLE : config.YELLOW);
                const label = `${this.active_power_up.toUpperCase()}: ${Math.floor(this.power_up_timer / 1000)}s`;
                this.ui.draw_text(ctx, label, this.ui.font_num_tiny, c, config.WIDTH / 2, 75);
                
                const bar_w = 120;
                const bar_x = config.WIDTH / 2 - bar_w / 2;
                const bar_y = 44;
                const frac = Math.max(0, this.power_up_timer / (this.power_up_max_timer || config.POWER_UP_DURATION * 1000));
                
                ctx.save();
                ctx.fillStyle = "rgb(30, 30, 50)";
                drawRoundRect(ctx, bar_x, bar_y, bar_w, 6, 3, true);
                ctx.fillStyle = c;
                if (bar_w * frac > 0) {
                    drawRoundRect(ctx, bar_x, bar_y, bar_w * frac, 6, 3, true);
                }
                ctx.restore();
            }

            ctx.restore();

            const tutorial_alpha = this.state === "SWIPE_TUTORIAL" ? Math.max(80, Math.floor(255 * (this.swipe_tutorial_timer / 2000))) : 255;
            this.control_manager.draw(ctx, this.state, tutorial_alpha);
        }

        this.ui.draw_particles(ctx, shake);
    }
}
