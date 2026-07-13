function applyAlpha(colorStr, alphaFraction) {
    if (colorStr.startsWith("rgb(")) {
        return colorStr.replace("rgb", "rgba").replace(")", `, ${alphaFraction})`);
    }
    return colorStr;
}

function drawRoundRect(ctx, x, y, w, h, r, fill = true, stroke = false, strokeWidth = 1) {
    ctx.beginPath();
    if (ctx.roundRect) {
        ctx.roundRect(x, y, w, h, r);
    } else {
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
    }
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) {
        ctx.lineWidth = strokeWidth;
        ctx.stroke();
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 4 + 1;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        
        this.life = 255;
        this.size = Math.floor(Math.random() * 4) + 2;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= 12;
        return this.life > 0;
    }

    draw(ctx, offset = [0, 0]) {
        if (this.life <= 0) return;
        const ox = offset[0];
        const oy = offset[1];

        ctx.save();
        ctx.fillStyle = applyAlpha(this.color, this.life / 255);
        ctx.beginPath();
        ctx.arc(this.x + ox, this.y + oy, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class UIManager {
    constructor() {
        this.font_large = "bold 85px ShepuFont1, 'Outfit', 'Segoe UI Emoji', sans-serif";
        this.font_mid = "42px ShepuFont2, 'Outfit', 'Segoe UI Emoji', sans-serif";
        this.font_small = "26px ShepuFont2, 'Outfit', 'Segoe UI Emoji', sans-serif";
        this.font_tiny = "18px ShepuFont2, 'Outfit', 'Segoe UI Emoji', sans-serif";
        this.font_button = "30px ShepuFont2, 'Outfit', 'Segoe UI Emoji', sans-serif";
        this.font_hud = "24px ShepuFont2, 'Outfit', 'Segoe UI Emoji', sans-serif";

        this.font_num_large = "bold 80px 'Orbitron', Verdana, sans-serif";
        this.font_num_mid = "bold 40px 'Orbitron', Verdana, sans-serif";
        this.font_num_small = "bold 24px 'Orbitron', Verdana, sans-serif";
        this.font_num_tiny = "bold 18px 'Orbitron', Verdana, sans-serif";

        this.particles = [];
        this.shake_amount = 0;
        this.shake_timer = 0;
    }

    draw_text(ctx, text, fontStyle, color, x, y, center = true, shadow = true, align = "left") {
        ctx.save();
        ctx.font = fontStyle;
        
        if (center) {
            ctx.textAlign = "center";
        } else if (align === "right") {
            ctx.textAlign = "right";
        } else {
            ctx.textAlign = "left";
        }
        ctx.textBaseline = "middle";

        if (shadow) {
            ctx.shadowBlur = 4;
            ctx.shadowColor = "rgba(0,0,0,0.6)";
            ctx.fillStyle = "rgb(10, 10, 20)";
            ctx.fillText(text, x + 2, y + 2);
        }

        ctx.fillStyle = color;
        ctx.fillText(text, x, y);
        ctx.restore();
    }

    draw_level_info(ctx, level, score, next_level_score) {
        const hud_x = 15;
        const hud_y = 15;
        const hud_w = 200;
        const hud_h = 80;

        ctx.save();
        ctx.fillStyle = "rgba(10, 10, 20, 0.7)";
        ctx.strokeStyle = config.BLUE;
        drawRoundRect(ctx, hud_x, hud_y, hud_w, hud_h, 10, true, true, 1.5);

        this.draw_text(ctx, `LEVEL ${level}`, this.font_num_small, config.CYAN, hud_x + 15, hud_y + 22, false, true);

        const bar_x = hud_x + 15;
        const bar_y = hud_y + 45;
        const bar_w = 170;
        const bar_h = 6;

        let prog = 1.0;
        if (next_level_score !== 'MAX') {
            const prev = config.LEVEL_UP_SCORES[level] || 0;
            prog = Math.min(1.0, (score - prev) / (next_level_score - prev));
        }

        ctx.fillStyle = "rgb(40, 40, 50)";
        drawRoundRect(ctx, bar_x, bar_y, bar_w, bar_h, 3, true);

        ctx.fillStyle = config.CYAN;
        if (bar_w * prog > 0) {
            drawRoundRect(ctx, bar_x, bar_y, bar_w * prog, bar_h, 3, true);
        }

        const xp_text = next_level_score === 'MAX' ? `${score} XP` : `${score} / ${next_level_score} XP`;
        this.draw_text(ctx, xp_text, this.font_num_tiny, config.LIGHT_GRAY, hud_x + 15, hud_y + 65, false, true);

        ctx.restore();
    }

    draw_overlay(ctx, alphaValue = 180) {
        ctx.save();
        ctx.fillStyle = `rgba(5, 5, 10, ${alphaValue / 255})`;
        ctx.fillRect(0, 0, config.WIDTH, config.HEIGHT);
        ctx.restore();
    }

    create_particles(x, y, color) {
        for (let i = 0; i < config.PARTICLE_COUNT; i++) {
            this.particles.push(new Particle(x, y, color));
        }
    }

    update_effects(dt) {
        this.particles = this.particles.filter(p => p.update());
        
        if (this.shake_timer > 0) {
            this.shake_timer -= dt;
            if (this.shake_timer <= 0) {
                this.shake_amount = 0;
            }
        }
    }

    trigger_shake(intensity = config.SHAKE_INTENSITY, duration = config.SHAKE_DURATION) {
        this.shake_amount = intensity;
        this.shake_timer = duration;
    }

    get_shake_offset() {
        if (this.shake_timer > 0) {
            return [
                Math.floor(Math.random() * (this.shake_amount * 2 + 1)) - this.shake_amount,
                Math.floor(Math.random() * (this.shake_amount * 2 + 1)) - this.shake_amount
            ];
        }
        return [0, 0];
    }

    draw_particles(ctx, offset = [0, 0]) {
        for (const p of this.particles) {
            p.draw(ctx, offset);
        }
    }
}
