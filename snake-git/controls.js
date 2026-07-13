const CONTROL_SWIPE = "swipe";
const CONTROL_CORNER = "corner";
const CONTROL_SPLIT = "split";

const CONTROL_LABELS = {
    [CONTROL_SWIPE]: "SWIPE",
    [CONTROL_CORNER]: "CORNER JOYSTICK",
    [CONTROL_SPLIT]: "SPLIT SCREEN",
};

const CONTROL_ORDER = [CONTROL_SWIPE, CONTROL_CORNER, CONTROL_SPLIT];

const SPLIT_GAME_RATIO = 0.80;
const CORNER_RADIUS = 72;
const CORNER_KNOB_RADIUS = 28;
const CORNER_DEADZONE = 10;
const SWIPE_MIN_DISTANCE = 22;

class PlayArea {
    constructor(screen_w, screen_h, control_mode = CONTROL_SWIPE, corner_side = "right") {
        this.screen_w = screen_w;
        this.screen_h = screen_h;
        this.control_mode = control_mode;
        this.corner_side = corner_side;
        this._recompute();
    }

    _recompute() {
        if (this.control_mode === CONTROL_SPLIT) {
            if (this.screen_w < this.screen_h) {
                // Portrait split: Top 70% for game, bottom 30% for controls
                const split_ratio = 0.70;
                this.play_w = this.screen_w;
                this.play_h = Math.floor(this.screen_h * split_ratio);
                this.offset_x = 0;
                this.offset_y = 0;
                
                this.panel_x = 0;
                this.panel_y = this.play_h;
                this.panel_w = this.screen_w;
                this.panel_h = this.screen_h - this.play_h;
                this.is_portrait_split = true;
            } else {
                // Landscape split: Left 80% for game, right 20% for controls
                this.play_w = Math.floor(this.screen_w * SPLIT_GAME_RATIO);
                this.play_h = this.screen_h;
                this.offset_x = 0;
                this.offset_y = 0;
                
                this.panel_x = this.play_w;
                this.panel_y = 0;
                this.panel_w = this.screen_w - this.play_w;
                this.panel_h = this.screen_h;
                this.is_portrait_split = false;
            }
        } else {
            this.play_w = this.screen_w;
            this.play_h = this.screen_h;
            this.offset_x = 0;
            this.offset_y = 0;
            this.panel_x = 0;
            this.panel_y = 0;
            this.panel_w = 0;
            this.panel_h = 0;
            this.is_portrait_split = false;
        }

        this.default_joystick_center = this._joystick_center();
        this.joystick_center = [...this.default_joystick_center];
        
        if (this.control_mode === CONTROL_CORNER) {
            this.joystick_radius = CORNER_RADIUS;
        } else {
            if (this.is_portrait_split) {
                this.joystick_radius = Math.min(90, Math.floor(this.panel_h / 2 - 12), Math.floor(this.panel_w / 2 - 24));
            } else {
                this.joystick_radius = Math.min(90, Math.floor(this.panel_w / 2 - 12), Math.floor(this.panel_h / 2 - 24));
            }
        }
    }

    reset_joystick_center() {
        this.joystick_center = [...this.default_joystick_center];
    }

    _joystick_center() {
        const margin = CORNER_RADIUS + 24;
        if (this.control_mode === CONTROL_SPLIT) {
            if (this.is_portrait_split) {
                return [Math.floor(this.screen_w / 2), Math.floor(this.panel_y + this.panel_h / 2)];
            } else {
                return [Math.floor(this.panel_x + this.panel_w / 2), Math.floor(this.screen_h / 2)];
            }
        }
        const y = this.screen_h - margin;
        if (this.corner_side === "left") {
            return [margin, y];
        }
        return [this.screen_w - margin, y];
    }

    update(screen_w, screen_h, control_mode = null, corner_side = null) {
        this.screen_w = screen_w;
        this.screen_h = screen_h;
        if (control_mode !== null) this.control_mode = control_mode;
        if (corner_side !== null) this.corner_side = corner_side;
        this._recompute();
    }

    game_rect() {
        return {
            x: this.offset_x,
            y: this.offset_y,
            w: this.play_w,
            h: this.play_h
        };
    }

    exclusion_rects() {
        const rects = [];
        if (this.control_mode === CONTROL_CORNER) {
            const [cx, cy] = this.joystick_center;
            const pad = CORNER_RADIUS + config.STEP * 2;
            rects.push({
                x: cx - pad,
                y: cy - pad,
                width: pad * 2,
                height: pad * 2
            });
        } else if (this.control_mode === CONTROL_SPLIT) {
            rects.push({
                x: this.panel_x,
                y: this.panel_y,
                width: this.panel_w,
                height: this.panel_h
            });
        }
        return rects;
    }

    is_in_play_area(x, y) {
        const rect = this.game_rect();
        return (x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h);
    }

    is_in_control_zone(x, y) {
        if (this.control_mode === CONTROL_CORNER) {
            const [cx, cy] = this.joystick_center;
            return Math.hypot(x - cx, y - cy) <= CORNER_RADIUS + 20;
        }
        if (this.control_mode === CONTROL_SPLIT) {
            if (this.is_portrait_split) {
                return y >= this.panel_y;
            } else {
                return x >= this.play_area.panel_x;
            }
        }
        return false;
    }

    apply_to_config() {
        config.PLAY_WIDTH = this.play_w;
        config.PLAY_HEIGHT = this.play_h;
        config.PLAY_OFFSET_X = this.offset_x;
        config.PLAY_OFFSET_Y = this.offset_y;
    }
}

function get_spawn_exclusion_rects() {
    const rects = [{ x: 0, y: 0, width: 220, height: 120 }];
    if (config._PLAY_AREA) {
        rects.push(...config._PLAY_AREA.exclusion_rects());
    }
    return rects;
}

function is_spawn_blocked(pos, snake_body, extra_blocked = null) {
    const s = config.STEP;
    const px = pos[0];
    const py = pos[1];

    for (const b of snake_body) {
        if (b[0] === px && b[1] === py) return true;
    }

    if (extra_blocked) {
        for (const item of extra_blocked) {
            if (Array.isArray(item) && item[0] === px && item[1] === py) {
                return true;
            }
            if (item && item.pos && item.pos[0] === px && item.pos[1] === py) {
                return true;
            }
        }
    }

    const play_w = config.PLAY_WIDTH || config.WIDTH;
    const play_h = config.PLAY_HEIGHT || config.HEIGHT;
    const ox = config.PLAY_OFFSET_X || 0;
    const oy = config.PLAY_OFFSET_Y || 0;

    if (px < ox || px > ox + play_w - s || py < oy || py > oy + play_h - s) {
        return true;
    }

    for (const r of get_spawn_exclusion_rects()) {
        const intersects = !(px + s <= r.x || px >= r.x + r.width || py + s <= r.y || py >= r.y + r.height);
        if (intersects) return true;
    }

    return false;
}

function find_spawn_position(snake_body, extra_blocked = null, max_tries = 500) {
    const w = config.PLAY_WIDTH || config.WIDTH;
    const h = config.PLAY_HEIGHT || config.HEIGHT;
    const ox = config.PLAY_OFFSET_X || 0;
    const oy = config.PLAY_OFFSET_Y || 0;
    const s = config.STEP;

    for (let i = 0; i < max_tries; i++) {
        const pos = [
            ox + random_grid(w, s),
            oy + random_grid(h, s)
        ];
        if (!is_spawn_blocked(pos, snake_body, extra_blocked)) {
            return pos;
        }
    }
    return [ox + Math.floor(w / 2), oy + Math.floor(h / 2)];
}

function random_grid(length, step) {
    const cells = Math.max(1, Math.floor(length / step));
    return Math.floor(Math.random() * cells) * step;
}

class ControlManager {
    constructor(game_data) {
        this.mode = game_data.control_mode || config.DEFAULT_CONTROL_MODE;
        this.corner_side = game_data.joystick_side || config.DEFAULT_JOYSTICK_SIDE;
        this.play_area = new PlayArea(config.WIDTH, config.HEIGHT, this.mode, this.corner_side);
        this.play_area.apply_to_config();
        config._PLAY_AREA = this.play_area;

        this._swipe_start = null;
        this._swipe_active = false;
        
        this._joystick_touch_id = null;
        this._knob_offset = [0, 0];
        this._pending_direction = null;
        this._swipe_image = null;
        this._load_swipe_image();
    }

    _load_swipe_image() {
        const img = new Image();
        img.src = resource_path("assets/images/swipe.png");
        this._swipe_image = img;
    }

    set_mode(mode, corner_side = null) {
        this.mode = mode;
        if (corner_side !== null) {
            this.corner_side = corner_side;
        }
        this.play_area.update(config.WIDTH, config.HEIGHT, this.mode, this.corner_side);
        this.play_area.apply_to_config();
        this.reset_touch_state();
    }

    cycle_mode() {
        const idx = CONTROL_ORDER.indexOf(this.mode);
        const nextMode = CONTROL_ORDER[(idx + 1) % CONTROL_ORDER.length];
        this.set_mode(nextMode);
    }

    reset_touch_state() {
        this._swipe_start = null;
        this._swipe_active = false;
        this._joystick_touch_id = null;
        this._knob_offset = [0, 0];
        this._pending_direction = null;
    }

    resize(width, height) {
        this.play_area.update(width, height);
        this.play_area.apply_to_config();
    }

    consume_direction() {
        const dir = this._pending_direction;
        this._pending_direction = null;
        return dir;
    }

    _queue_direction(direction) {
        this._pending_direction = direction;
    }

    _direction_from_delta(dx, dy) {
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return null;
        if (Math.abs(dx) > Math.abs(dy)) {
            return dx > 0 ? "RIGHT" : "LEFT";
        }
        return dy > 0 ? "DOWN" : "UP";
    }

    _joystick_direction(dx, dy) {
        const dist = Math.hypot(dx, dy);
        if (dist < CORNER_DEADZONE) return null;
        return this._direction_from_delta(dx, dy);
    }

    handleInputStart(x, y, identifier = 0, game_state) {
        if (game_state !== "PLAYING" && game_state !== "SWIPE_TUTORIAL") return false;

        if (this.mode === CONTROL_SWIPE) {
            this._swipe_start = [x, y];
            this._swipe_active = true;
            return true;
        } else if (this.mode === CONTROL_CORNER) {
            const is_right_half = x > this.play_area.screen_w / 2;
            const matches_side = (this.corner_side === "right" && is_right_half) || (this.corner_side === "left" && !is_right_half);
            
            if (matches_side) {
                this._joystick_touch_id = identifier;
                this.play_area.joystick_center = [x, y];
                this._knob_offset = [0, 0];
                return true;
            }
        } else if (this.mode === CONTROL_SPLIT) {
            const in_panel = this.play_area.is_portrait_split
                ? (y >= this.play_area.panel_y)
                : (x >= this.play_area.panel_x);
            if (in_panel) {
                this._joystick_touch_id = identifier;
                this.play_area.joystick_center = [x, y];
                this._knob_offset = [0, 0];
                return true;
            }
        }
        return false;
    }

    handleInputMove(x, y, identifier = 0, game_state) {
        if (this.mode === CONTROL_SWIPE && this._swipe_active && this._swipe_start) {
            const dx = x - this._swipe_start[0];
            const dy = y - this._swipe_start[1];
            if (Math.hypot(dx, dy) >= SWIPE_MIN_DISTANCE) {
                const dir = this._direction_from_delta(dx, dy);
                if (dir) {
                    this._queue_direction(dir);
                    this._swipe_start = [x, y];
                }
            }
            return true;
        }

        if (this._joystick_touch_id !== null && this._joystick_touch_id === identifier) {
            this._update_knob(x, y);
            return true;
        }
        return false;
    }

    handleInputEnd(x, y, identifier = 0, game_state) {
        if (this.mode === CONTROL_SWIPE && this._swipe_active && this._swipe_start) {
            const dx = x - this._swipe_start[0];
            const dy = y - this._swipe_start[1];
            if (Math.hypot(dx, dy) >= SWIPE_MIN_DISTANCE) {
                const dir = this._direction_from_delta(dx, dy);
                if (dir) {
                    this._queue_direction(dir);
                }
            }
            this._swipe_start = null;
            this._swipe_active = false;
            return true;
        }

        if (this._joystick_touch_id !== null && this._joystick_touch_id === identifier) {
            this._knob_offset = [0, 0];
            this._joystick_touch_id = null;
            this.play_area.reset_joystick_center();
            return true;
        }
        return false;
    }

    _near_joystick(x, y) {
        const [cx, cy] = this.play_area.joystick_center;
        return Math.hypot(x - cx, y - cy) <= this.play_area.joystick_radius + 36;
    }

    _update_knob(x, y) {
        const [cx, cy] = this.play_area.joystick_center;
        let dx = x - cx;
        let dy = y - cy;
        const dist = Math.hypot(dx, dy);
        const max_dist = this.play_area.joystick_radius;

        if (dist > max_dist) {
            const scale = max_dist / dist;
            dx *= scale;
            dy *= scale;
        }

        this._knob_offset = [dx, dy];
        const direction = this._joystick_direction(dx, dy);
        if (direction) {
            this._queue_direction(direction);
        }
    }

    draw(ctx, game_state, swipe_tutorial_alpha = 255) {
        if (game_state === "SWIPE_TUTORIAL") return; // HTML Swipe Tutorial Overlay handles this!

        if (game_state !== "PLAYING") return;

        if (this.mode === CONTROL_CORNER) {
            this._draw_corner_joystick(ctx);
        } else if (this.mode === CONTROL_SPLIT) {
            this._draw_split_panel(ctx);
            this._draw_corner_joystick(ctx, true);
        }
    }

    _draw_swipe_tutorial(ctx, alpha) {
        ctx.save();
        ctx.fillStyle = `rgba(0, 0, 0, ${(alpha / 255) * 0.6})`;
        ctx.fillRect(0, 0, config.WIDTH, config.HEIGHT);

        if (this._swipe_image && this._swipe_image.complete) {
            const max_w = Math.floor(config.WIDTH * 0.55);
            const ratio = max_w / this._swipe_image.width;
            const size_w = max_w;
            const size_h = Math.floor(this._swipe_image.height * ratio);

            ctx.globalAlpha = alpha / 255;
            ctx.drawImage(this._swipe_image, config.WIDTH / 2 - size_w / 2, config.HEIGHT / 2 - 30 - size_h / 2, size_w, size_h);
        } else {
            ctx.font = "bold 28px sans-serif";
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha / 255})`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("SWIPE TO MOVE", config.WIDTH / 2, config.HEIGHT / 2 - 40);
        }

        ctx.font = "20px Arial";
        ctx.fillStyle = `rgba(200, 220, 255, ${alpha / 255})`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("সোয়াইপ করে সাপ নিয়ন্ত্রণ করুন", config.WIDTH / 2, config.HEIGHT / 2 + 80);
        ctx.restore();
    }

    _draw_split_panel(ctx) {
        const px = this.play_area.panel_x;
        const py = this.play_area.panel_y || 0;
        const pw = this.play_area.panel_w;
        const ph = this.play_area.panel_h;

        ctx.save();
        ctx.fillStyle = "rgb(12, 14, 28)";
        ctx.fillRect(px, py, pw, ph);

        ctx.strokeStyle = "rgb(0, 180, 220)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        if (this.play_area.is_portrait_split) {
            ctx.moveTo(0, py);
            ctx.lineTo(this.play_area.screen_w, py);
        } else {
            ctx.moveTo(px, 0);
            ctx.lineTo(px, ph);
        }
        ctx.stroke();

        ctx.font = "bold 16px sans-serif";
        ctx.fillStyle = "rgb(120, 200, 255)";
        ctx.textAlign = "center";
        if (this.play_area.is_portrait_split) {
            ctx.fillText("JOYSTICK ZONE", this.play_area.screen_w / 2, py + 22);
        } else {
            ctx.fillText("JOYSTICK", px + pw / 2, 28);
        }
        ctx.restore();
    }

    _draw_corner_joystick(ctx, in_panel = false) {
        const [cx, cy] = this.play_area.joystick_center;
        const r = this.play_area.joystick_radius;

        ctx.save();

        // 1. Draw outer ring glow
        ctx.shadowColor = "rgba(0, 188, 255, 0.55)";
        ctx.shadowBlur = 12;
        ctx.strokeStyle = "rgba(0, 220, 255, 0.85)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0; // Turn off glow for other elements to optimize performance

        // 2. Draw outer ring ticks / notches (four direction notches)
        ctx.strokeStyle = "rgba(0, 255, 210, 0.4)";
        ctx.lineWidth = 1.5;
        const ticks = [0, Math.PI/2, Math.PI, Math.PI*1.5];
        for (const angle of ticks) {
            const sx = cx + Math.cos(angle) * (r - 10);
            const sy = cy + Math.sin(angle) * (r - 10);
            const ex = cx + Math.cos(angle) * r;
            const ey = cy + Math.sin(angle) * r;
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(ex, ey);
            ctx.stroke();
        }

        // 3. Draw joystick base center details (target reticle)
        ctx.fillStyle = "rgba(16, 20, 36, 0.55)";
        ctx.beginPath();
        ctx.arc(cx, cy, r - 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "rgba(0, 188, 255, 0.2)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.4, 0, Math.PI * 2);
        ctx.stroke();

        // Crosshairs in the center
        ctx.beginPath();
        ctx.moveTo(cx - 8, cy); ctx.lineTo(cx + 8, cy);
        ctx.moveTo(cx, cy - 8); ctx.lineTo(cx, cy + 8);
        ctx.stroke();

        const kx = cx + this._knob_offset[0];
        const ky = cy + this._knob_offset[1];

        // 4. Draw dynamic connection wire (elastic leash line)
        if (Math.hypot(kx - cx, ky - cy) > 2) {
            ctx.strokeStyle = "rgba(0, 255, 210, 0.35)";
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(kx, ky);
            ctx.stroke();
        }

        // 5. Draw Knob with modern radial gradient and glow
        const knob_grad = ctx.createRadialGradient(kx, ky, 2, kx, ky, CORNER_KNOB_RADIUS);
        knob_grad.addColorStop(0, "rgb(0, 255, 210)");
        knob_grad.addColorStop(0.3, "rgb(0, 150, 220)");
        knob_grad.addColorStop(1, "rgb(10, 20, 48)");

        ctx.save();
        ctx.shadowColor = "rgba(0, 255, 210, 0.65)";
        ctx.shadowBlur = 10;
        ctx.fillStyle = knob_grad;
        ctx.beginPath();
        ctx.arc(kx, ky, CORNER_KNOB_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Knob outer bevel border
        ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(kx, ky, CORNER_KNOB_RADIUS - 1, 0, Math.PI * 2);
        ctx.stroke();

        // Inner thumb grip circle
        ctx.strokeStyle = "rgba(0, 255, 210, 0.5)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(kx, ky, CORNER_KNOB_RADIUS * 0.45, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
    }
}
