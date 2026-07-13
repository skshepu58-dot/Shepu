class CinematicIntro {
    constructor(width, height, font_large, font_small) {
        this.width = width;
        this.height = height;
        this.font_large = font_large;
        this.font_small = font_small;

        this.timer = 0;
        this.done = false;
        
        this.logo_alpha = 0;

        this.particles = [];
        for (let i = 0; i < 25; i++) {
            this.particles.push({
                x: Math.random() * width,
                y: Math.random() * height,
                v: Math.random() * 0.03 + 0.02,
                s: Math.floor(Math.random() * 3) + 1
            });
        }
    }

    update(dt) {
        this.timer += dt;
        if (this.timer > 4500) {
            this.done = true;
        }
    }

    draw(ctx, width, height) {
        if (this.width !== width || this.height !== height) {
            this.width = width;
            this.height = height;
        }

        ctx.fillStyle = "rgb(12, 12, 18)";
        ctx.fillRect(0, 0, this.width, this.height);

        const mid_x = this.width / 2;
        const mid_y = this.height / 2;
        const t = this.timer;

        ctx.save();
        ctx.fillStyle = "rgba(0, 255, 255, 0.39)";
        for (const p of this.particles) {
            p.y -= p.v * 16;
            if (p.y < 0) {
                p.y = this.height;
                p.x = Math.random() * this.width;
            }
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.s, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();

        if (t < 1200) {
            const scan_y = (t / 1200) * this.height;

            ctx.save();
            ctx.strokeStyle = "rgb(0, 180, 255)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, scan_y);
            ctx.lineTo(this.width, scan_y);
            ctx.stroke();

            ctx.fillStyle = "rgba(0, 150, 255, 0.08)";
            ctx.fillRect(0, scan_y - 15, this.width, 30);
            ctx.restore();
        }

        if (t > 1200 && t < 4500) {
            const brand_t = Math.min(1.0, (t - 1200) / 1000);
            this.logo_alpha = brand_t;

            ctx.save();
            ctx.font = "bold 24px Verdana, sans-serif";
            ctx.fillStyle = `rgba(220, 220, 240, ${this.logo_alpha})`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("S H E P U", mid_x, mid_y - 80);

            const line_w = Math.floor(brand_t * 120);
            ctx.strokeStyle = `rgba(60, 60, 80, ${this.logo_alpha})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(mid_x - line_w, mid_y - 50);
            ctx.lineTo(mid_x + line_w, mid_y - 50);
            ctx.stroke();
            ctx.restore();
        }

        if (t > 2200) {
            const title_t = Math.min(1.0, (t - 2200) / 1000);
            const title_alpha = title_t;

            const frame_w = 420;
            const frame_h = 90;
            const fx = mid_x - frame_w / 2;
            const fy = mid_y - frame_h / 2;
            const c_len = 15;

            ctx.save();
            ctx.strokeStyle = `rgba(0, 255, 255, ${title_alpha})`;
            ctx.lineWidth = 2;

            ctx.beginPath();
            ctx.moveTo(fx, fy + c_len);
            ctx.lineTo(fx, fy);
            ctx.lineTo(fx + c_len, fy);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(fx + frame_w - c_len, fy + frame_h);
            ctx.lineTo(fx + frame_w, fy + frame_h);
            ctx.lineTo(fx + frame_w, fy + frame_h - c_len);
            ctx.stroke();

            ctx.font = this.font_large;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillStyle = `rgba(0, 255, 255, ${title_alpha * 0.3})`;
            const offsets = [[2, 2], [-2, -2], [2, -2], [-2, 2]];
            for (const off of offsets) {
                ctx.fillText("SNAKE PRO", mid_x + off[0], mid_y + off[1]);
            }

            ctx.fillStyle = `rgba(255, 255, 255, ${title_alpha})`;
            ctx.fillText("SNAKE PRO", mid_x, mid_y);
            ctx.restore();

            if (t > 3000) {
                const sub_alpha = Math.min(1.0, (t - 3000) / 1000);
                ctx.save();
                ctx.font = this.font_small;
                ctx.fillStyle = `rgba(160, 160, 180, ${sub_alpha})`;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText("PROFESSIONAL EDITION", mid_x, mid_y + 100);
                ctx.restore();
            }
        }

        this._draw_vignette(ctx);

        if (t > 2180 && t < 2220) {
            ctx.save();
            ctx.fillStyle = "rgba(20, 20, 40, 0.4)";
            ctx.globalCompositeOperation = "lighter";
            ctx.fillRect(0, 0, this.width, this.height);
            ctx.restore();
        }
    }

    _draw_vignette(ctx) {
        ctx.save();
        const grad = ctx.createRadialGradient(this.width / 2, this.height / 2, this.width / 4, this.width / 2, this.height / 2, this.width / 2);
        grad.addColorStop(0, "rgba(0, 0, 0, 0)");
        grad.addColorStop(1, "rgba(0, 0, 0, 0.55)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, this.width, this.height);
        ctx.restore();
    }
}
