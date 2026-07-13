function _play_bounds() {
    return [
        config.PLAY_WIDTH || config.WIDTH,
        config.PLAY_HEIGHT || config.HEIGHT,
        config.PLAY_OFFSET_X || 0,
        config.PLAY_OFFSET_Y || 0
    ];
}

class Snake {
    constructor() {
        this.input_queue = [];
        this.reset();
    }

    reset() {
        const [w, h, ox, oy] = _play_bounds();
        const s = config.STEP;
        const cx = ox + Math.floor(w / 2 / s) * s;
        const cy = oy + Math.floor(h / 2 / s) * s;

        this.pos = [cx, cy];
        this.body = [
            [cx, cy],
            [cx - s, cy],
            [cx - (2 * s), cy]
        ];
        this.prev_body = this.body.map(p => [...p]);
        this.direction = 'RIGHT';
        this.input_queue = [];
    }

    handle_input(keyString) {
        const last = this.input_queue.length > 0 ? this.input_queue[this.input_queue.length - 1] : this.direction;
        const OPPOSITES = { 'UP': 'DOWN', 'DOWN': 'UP', 'LEFT': 'RIGHT', 'RIGHT': 'LEFT' };
        
        const KEY_MAP = {
            'ArrowUp': 'UP', 'ArrowDown': 'DOWN', 'ArrowLeft': 'LEFT', 'ArrowRight': 'RIGHT',
            'w': 'UP', 's': 'DOWN', 'a': 'LEFT', 'd': 'RIGHT',
            'W': 'UP', 'S': 'DOWN', 'A': 'LEFT', 'D': 'RIGHT'
        };

        const new_dir = KEY_MAP[keyString];
        this.queue_direction(new_dir, OPPOSITES, last);
    }

    queue_direction(new_dir, opposites = null, last = null) {
        if (!new_dir) return;
        if (opposites === null) {
            opposites = { 'UP': 'DOWN', 'DOWN': 'UP', 'LEFT': 'RIGHT', 'RIGHT': 'LEFT' };
        }
        if (last === null) {
            last = this.input_queue.length > 0 ? this.input_queue[this.input_queue.length - 1] : this.direction;
        }

        if (new_dir !== opposites[last] && new_dir !== last) {
            if (this.input_queue.length < 2) {
                this.input_queue.push(new_dir);
            }
        }
    }

    move(grow = false) {
        this.prev_body = this.body.map(p => [...p]);
        if (this.input_queue.length > 0) {
            this.direction = this.input_queue.shift();
        }

        const s = config.STEP;
        if (this.direction === 'UP') {
            this.pos[1] -= s;
        } else if (this.direction === 'DOWN') {
            this.pos[1] += s;
        } else if (this.direction === 'LEFT') {
            this.pos[0] -= s;
        } else if (this.direction === 'RIGHT') {
            this.pos[0] += s;
        }

        this.body.unshift([...this.pos]);
        if (!grow) {
            this.body.pop();
        }
    }

    check_collision(mode = "Classic", ghost_mode = false) {
        if (ghost_mode) return false;
        const [w, h, ox, oy] = _play_bounds();
        const s = config.STEP;

        if (mode !== "No Wall") {
            if (this.pos[0] < ox || this.pos[0] > ox + w - s ||
                this.pos[1] < oy || this.pos[1] > oy + h - s) {
                return true;
            }
        } else {
            if (this.pos[0] < ox) {
                this.pos[0] = ox + w - s;
            } else if (this.pos[0] > ox + w - s) {
                this.pos[0] = ox;
            } else if (this.pos[1] < oy) {
                this.pos[1] = oy + h - s;
            } else if (this.pos[1] > oy + h - s) {
                this.pos[1] = oy;
            }
            this.body[0] = [...this.pos];
        }

        for (let i = 1; i < this.body.length; i++) {
            if (this.pos[0] === this.body[i][0] && this.pos[1] === this.body[i][1]) {
                return true;
            }
        }
        return false;
    }

    draw(ctx, assets, skin = "classic", offset = [0, 0], interp = 1.0, style = "Robotic") {
        const [ox, oy] = offset;
        const s = config.STEP;
        const render_size = Math.floor(s * 1.15);
        const offset_val = Math.floor((render_size - s) / 2);

        if (style === "Robotic") interp = 1.0;

        const head_key = skin !== "classic" ? `head_${skin}` : "head";
        const body_key = skin !== "classic" ? `body_${skin}` : "body";
        const tail_key = skin !== "classic" ? `tail_${skin}` : "tail";

        const get_interp_pos = (idx) => {
            const curr = this.body[idx];
            if (style === "Robotic") return curr;
            const prev = (idx < this.prev_body.length) ? this.prev_body[idx] : curr;
            
            if (Math.abs(curr[0] - prev[0]) > s * 2 || Math.abs(curr[1] - prev[1]) > s * 2) {
                return curr;
            }
            return [
                prev[0] + (curr[0] - prev[0]) * interp,
                prev[1] + (curr[1] - prev[1]) * interp
            ];
        };

        const get_angle = (idx) => {
            const curr = this.body[idx];
            const prev_seg = idx > 0 ? this.body[idx - 1] : null;

            if (style === "Robotic") {
                if (idx === 0) {
                    if (this.direction === 'UP') return 90;
                    if (this.direction === 'DOWN') return -90;
                    if (this.direction === 'LEFT') return 180;
                    return 0;
                }
                if (prev_seg) {
                    const dx = curr[0] - prev_seg[0];
                    const dy = curr[1] - prev_seg[1];
                    if (dx > 0) return 0;
                    if (dx < 0) return 180;
                    if (dy > 0) return -90;
                    if (dy < 0) return 90;
                }
                return 0;
            }

            let target_angle = 0;
            if (prev_seg) {
                const dx = curr[0] - prev_seg[0];
                const dy = curr[1] - prev_seg[1];
                if (Math.abs(dx) > s * 2 || Math.abs(dy) > s * 2) {
                    if (this.direction === 'UP') target_angle = 90;
                    else if (this.direction === 'DOWN') target_angle = -90;
                    else if (this.direction === 'LEFT') target_angle = 180;
                    else target_angle = 0;
                } else {
                    target_angle = Math.atan2(-dy, dx) * 180 / Math.PI;
                }
            } else {
                if (this.direction === 'UP') target_angle = 90;
                else if (this.direction === 'DOWN') target_angle = -90;
                else if (this.direction === 'LEFT') target_angle = 180;
                else if (this.direction === 'RIGHT') target_angle = 0;
            }
            return target_angle;
        };

        for (let i = this.body.length - 1; i >= 0; i--) {
            const pos = get_interp_pos(i);
            const pyAngle = get_angle(i);
            const jsAngle = -pyAngle * Math.PI / 180;

            const rx = pos[0] + ox;
            const ry = pos[1] + oy;

            if (style === "Realistic") {
                ctx.save();
                ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
                ctx.beginPath();
                ctx.arc(rx + s / 2 + 4, ry + s / 2 + 4, render_size / 2, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }

            let img = null;
            if (i === 0) {
                img = assets.images[head_key] || assets.images['head'];
            } else if (i === this.body.length - 1) {
                img = assets.images[tail_key] || assets.images['tail'];
            } else {
                img = assets.images[body_key] || assets.images['body'];
            }

            ctx.save();
            ctx.translate(rx + s / 2, ry + s / 2);
            ctx.rotate(jsAngle);
            if (img && img.complete) {
                ctx.drawImage(img, -render_size / 2, -render_size / 2, render_size, render_size);
            } else {
                ctx.fillStyle = (i === 0) ? config.CYAN : config.GREEN;
                ctx.fillRect(-s / 2, -s / 2, s, s);
            }
            ctx.restore();
        }
    }
}

class Food {
    constructor(ftype = "normal") {
        this.type = ftype;
        this.pos = [0, 0];
        this.active = false;
        this.spawn_time = 0;
    }

    spawn(snake_body) {
        this.pos = find_spawn_position(snake_body);
        this.active = true;
        this.spawn_time = Date.now();
    }
}

class ShepuFood {
    constructor() {
        this.pos = [0, 0];
        this.active = false;
        this.spawn_time = 0;
        this.variants = ['shepuf1', 'shepuf2', 'shepuf3'];
        this.variant = this.variants[Math.floor(Math.random() * this.variants.length)];
    }

    spawn(snake_body, obstacles = null) {
        const blocked = [...snake_body];
        if (obstacles) {
            blocked.push(...obstacles.map(o => o.pos));
        }
        this.pos = find_spawn_position(snake_body, blocked);
        this.active = true;
        this.spawn_time = Date.now();
        this.variant = this.variants[Math.floor(Math.random() * this.variants.length)];
    }

    draw(ctx, assets, offset = [0, 0]) {
        if (!this.active) return;
        const [ox, oy] = offset;
        const img = assets.images[this.variant];
        const s = config.STEP;
        const size = Math.floor(s * 1.2);

        if (img && img.complete) {
            ctx.drawImage(img, this.pos[0] + ox - (size - s) / 2, this.pos[1] + oy - (size - s) / 2, size, size);
        } else {
            ctx.fillStyle = config.GOLD;
            ctx.beginPath();
            ctx.arc(this.pos[0] + ox + s / 2, this.pos[1] + oy + s / 2, s / 2, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

class Obstacle {
    constructor(pos, moving = false) {
        this.pos = [...pos];
        this.moving = moving;
        if (moving) {
            this.vx = Math.random() < 0.5 ? -2 : 2;
            this.vy = Math.random() < 0.5 ? -2 : 2;
        } else {
            this.vx = 0;
            this.vy = 0;
        }
    }

    update() {
        if (!this.moving) return;
        this.pos[0] += this.vx;
        this.pos[1] += this.vy;

        const [w, h, ox, oy] = _play_bounds();
        const s = config.STEP;
        if (this.pos[0] < ox || this.pos[0] > ox + w - s) this.vx *= -1;
        if (this.pos[1] < oy || this.pos[1] > oy + h - s) this.vy *= -1;
    }

    draw(ctx, assets, offset = [0, 0]) {
        const [ox, oy] = offset;
        const img = assets.images['obstacle'];
        const s = config.STEP;
        if (img && img.complete) {
            ctx.drawImage(img, this.pos[0] + ox, this.pos[1] + oy, s, s);
        } else {
            ctx.fillStyle = config.DARK_GRAY;
            ctx.fillRect(this.pos[0] + ox, this.pos[1] + oy, s, s);
        }
    }
}

class PowerUp {
    constructor(ptype = "ghost") {
        this.type = ptype;
        this.pos = [0, 0];
        this.active_on_field = false;
        this.spawn_time = 0;
        this.pulse = 0;
        this.pulse_dir = 1;
    }

    spawn(snake_body, obstacles) {
        const blocked = [...snake_body];
        if (obstacles) {
            blocked.push(...obstacles.map(o => o.pos));
        }
        this.pos = find_spawn_position(snake_body, blocked);
        this.active_on_field = true;
        this.spawn_time = Date.now();
    }

    draw(ctx, assets, offset = [0, 0]) {
        if (!this.active_on_field) return;
        const [ox, oy] = offset;
        
        this.pulse += 0.2 * this.pulse_dir;
        if (this.pulse > 5 || this.pulse < 0) this.pulse_dir *= -1;

        const s = config.STEP;
        const cx = this.pos[0] + s / 2 + ox;
        const cy = this.pos[1] + s / 2 + oy;

        let img_key = "";
        let color = "rgb(255, 255, 255)";
        if (this.type === "ghost") {
            img_key = 'pu_ghost';
            color = "rgb(160, 32, 240)";
        } else if (this.type === "slowmo") {
            img_key = 'pu_slowmo';
            color = "rgb(0, 255, 255)";
        } else if (this.type === "double") {
            img_key = 'pu_double';
            color = "rgb(255, 215, 0)";
        }

        const img = assets.images[img_key];
        ctx.save();

        if (img && img.complete) {
            const scale_factor = 1.0 + (this.pulse / 30.0);
            const raw_size = Math.floor(s * 1.4);
            const iw = Math.floor(raw_size * scale_factor);
            const ih = Math.floor(raw_size * scale_factor);

            const glow_r = Math.floor(iw / 2) + 4;
            const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, glow_r);
            grad.addColorStop(0, color.replace("rgb", "rgba").replace(")", ", 0.4)"));
            grad.addColorStop(1, "rgba(0,0,0,0)");
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(cx, cy, glow_r, 0, Math.PI * 2);
            ctx.fill();

            ctx.drawImage(img, cx - iw / 2, cy - ih / 2, iw, ih);
        } else {
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(cx, cy, s / 2 + this.pulse, 0, Math.PI * 2);
            ctx.stroke();

            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(cx, cy, s / 3, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
}

class Boss {
    constructor() {
        this.pos = [0, 0];
        this.pulse = 0;
        this.pulse_dir = 1;
        this.health = 3;
        this.speed = 1.0;
        this.active = false;
        this._sine_time = 0.0;
        this._sine_amp = 60.0;
        this._sine_freq = 1.8;
    }

    reset(level) {
        const [w, h, ox, oy] = _play_bounds();
        this.pos = [ox + w - 100, oy + h - 100];
        this.pulse = 0;
        this.pulse_dir = 1;
        this.health = 3 + level;
        this.speed = 1.0 + (level * 0.15);
        this.active = false;
        this._sine_time = 0.0;
        this._sine_amp = 60.0;
        this._sine_freq = 1.8;
    }

    update(dt, snake_pos) {
        if (!this.active) return;
        this._sine_time += 0.001 * dt;
        const dx = snake_pos[0] - this.pos[0];
        const dy = snake_pos[1] - this.pos[1];
        const dist = Math.hypot(dx, dy);

        if (dist > 1) {
            const nx = dx / dist;
            const ny = dy / dist;
            const perp_x = -ny;
            const perp_y = nx;

            const sine_offset = Math.sin(this._sine_time * this._sine_freq) * this._sine_amp;
            
            this.pos[0] += (nx * this.speed + perp_x * sine_offset * 0.04) * (dt / 16);
            this.pos[1] += (ny * this.speed + perp_y * sine_offset * 0.04) * (dt / 16);
        }

        const [w, h, ox, oy] = _play_bounds();
        this.pos[0] = Math.max(ox, Math.min(ox + w, this.pos[0]));
        this.pos[1] = Math.max(oy, Math.min(oy + h, this.pos[1]));

        this.pulse += 0.5 * this.pulse_dir;
        if (this.pulse > 15 || this.pulse < 0) this.pulse_dir *= -1;
    }

    draw(ctx, assets, offset = [0, 0]) {
        if (!this.active) return;
        const [ox, oy] = offset;
        const s = config.STEP;
        const radius = s * 2 + Math.floor(this.pulse);
        const cx = Math.floor(this.pos[0] + ox);
        const cy = Math.floor(this.pos[1] + oy);

        const img = assets.images['boss_img'];
        ctx.save();

        if (img && img.complete) {
            const scale_factor = 1.0 + (this.pulse / 80.0);
            const raw_size = Math.floor(s * 3.5);
            const iw = Math.floor(raw_size * scale_factor);
            const ih = Math.floor(raw_size * scale_factor);

            const glow_r = Math.floor(iw / 2) + 8;
            const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, glow_r);
            grad.addColorStop(0, "rgba(255, 0, 0, 0.45)");
            grad.addColorStop(1, "rgba(0,0,0,0)");
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(cx, cy, glow_r, 0, Math.PI * 2);
            ctx.fill();

            ctx.drawImage(img, cx - iw / 2, cy - ih / 2, iw, ih);
        } else {
            for (let i = 0; i < 3; i++) {
                const alpha = (150 - (i * 40)) / 255;
                ctx.fillStyle = `rgba(255, 0, 0, ${alpha})`;
                ctx.beginPath();
                ctx.arc(cx, cy, radius - (i * 10), 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.fillStyle = "rgb(255, 50, 50)";
            ctx.beginPath();
            ctx.arc(cx, cy, s, 0, Math.PI * 2);
            ctx.fill();
        }

        const bar_w = 60;
        const bar_x = Math.floor(this.pos[0] - bar_w / 2 + ox);
        const bar_y = Math.floor(this.pos[1] - radius - 14 + oy);
        
        const hp_frac = Math.max(0, Math.min(1.0, this.health / 10));

        ctx.fillStyle = "rgb(60, 0, 0)";
        if (ctx.roundRect) {
            ctx.beginPath();
            ctx.roundRect(bar_x, bar_y, bar_w, 8, 4);
            ctx.fill();
        } else {
            ctx.fillRect(bar_x, bar_y, bar_w, 8);
        }

        ctx.fillStyle = "rgb(255, 50, 50)";
        if (bar_w * hp_frac > 0) {
            if (ctx.roundRect) {
                ctx.beginPath();
                ctx.roundRect(bar_x, bar_y, bar_w * hp_frac, 8, 4);
                ctx.fill();
            } else {
                ctx.fillRect(bar_x, bar_y, bar_w * hp_frac, 8);
            }
        }
        ctx.restore();
    }
}

class MatrixFood {
    constructor() {
        this.pos = [0, 0];
        this.active = false;
        this.spawn_time = 0;
        this.pulse = 0;
        this.pulse_dir = 1;
    }

    spawn(snake_body, entities) {
        const blocked = [...snake_body];
        if (entities) {
            for (const ent of entities) {
                if (Array.isArray(ent)) {
                    blocked.push(ent);
                } else if (ent && ent.pos) {
                    blocked.push(ent.pos);
                }
            }
        }
        this.pos = find_spawn_position(snake_body, blocked);
        this.active = true;
        this.spawn_time = Date.now();
    }

    draw(ctx, assets, offset = [0, 0]) {
        if (!this.active) return;
        const [ox, oy] = offset;

        this.pulse += 0.3 * this.pulse_dir;
        if (this.pulse > 8 || this.pulse < 0) this.pulse_dir *= -1;

        const s = config.STEP;
        const cx = this.pos[0] + s / 2 + ox;
        const cy = this.pos[1] + s / 2 + oy;

        const img = assets.images['pu_hack'];
        ctx.save();

        if (img && img.complete) {
            const scale_factor = 1.0 + (this.pulse / 40.0);
            const raw_size = s;
            const iw = Math.floor(raw_size * scale_factor);
            const ih = Math.floor(raw_size * scale_factor);

            const glow_r = Math.floor(iw / 2) + 5;
            const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, glow_r);
            grad.addColorStop(0, "rgba(0, 255, 70, 0.4)");
            grad.addColorStop(1, "rgba(0,0,0,0)");
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(cx, cy, glow_r, 0, Math.PI * 2);
            ctx.fill();

            ctx.drawImage(img, cx - iw / 2, cy - ih / 2, iw, ih);
        } else {
            ctx.strokeStyle = "rgb(0, 255, 0)";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(cx, cy, s / 2 + this.pulse, 0, Math.PI * 2);
            ctx.stroke();

            ctx.fillStyle = "rgb(0, 100, 0)";
            ctx.beginPath();
            ctx.arc(cx, cy, s / 3, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
}
