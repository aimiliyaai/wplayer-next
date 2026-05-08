import utils from './utils';

class Danmaku {
  constructor(options) {
    this.options = options;
    this.player = this.options.player;
    this.container = this.options.container;
    this.danTunnel = {
      right: {},
      top: {},
      bottom: {},
    };
    this.danIndex = 0;
    this.dan = [];
    // 与初始 paused 的视频对齐；勿沿用 undefined（会被当成未暂停，易在首帧把 danIndex 扫到末尾）
    this.paused = true;
    this.showing = true;
    this._opacity = this.options.opacity;
    this.events = this.options.events;
    this.unlimited = this.options.unlimited;
    this._frameRafId = null;
    this._destroyed = false;
    this._measure('');

    this.load();
  }

  _scheduleFrame() {
    if (this._destroyed) {
      return;
    }
    if (this._frameRafId != null) {
      cancelAnimationFrame(this._frameRafId);
    }
    this._frameRafId = requestAnimationFrame(() => {
      this._frameRafId = null;
      this.frame();
    });
  }

  load() {
    if (this._destroyed) {
      return;
    }
    if (this.options.data && this.options.data.length) {
      this.dan = [...this.options.data].sort((a, b) => {
        const ta = parseFloat(a.time);
        const tb = parseFloat(b.time);
        return (Number.isFinite(ta) ? ta : 0) - (Number.isFinite(tb) ? tb : 0);
      });
    } else if (this.options.data) {
      this.dan = [];
    }

    this.syncReadIndexToVideoTime();

    this._scheduleFrame();

    this.options.callback();
    this.events && this.events.trigger('danmaku_loaded');
  }

  reload() {
    this.dan = [];
    this.clear();
    this.load();
  }

  update(data) {
    if (data) {
      this.options.data = data;
    }
    this.reload();
  }

  send(dan, callback) {
    if (this._destroyed) {
      return;
    }
    const t = this._clock();
    const danmakuData = {
      time: t,
      text: dan.text,
      color: dan.color,
      type: dan.type,
    };

    callback(danmakuData);

    // 按时间插入，禁止在 danIndex 直接 splice（会破坏有序性，导致后续漏播）
    let insertAt = this.dan.length;
    for (let k = 0; k < this.dan.length; k++) {
      const bt = parseFloat(this.dan[k].time);
      if (Number.isFinite(bt) && bt > t) {
        insertAt = k;
        break;
      }
    }
    this.dan.splice(insertAt, 0, danmakuData);
    if (insertAt <= this.danIndex) {
      this.danIndex++;
    }
    const danmaku = {
      text: this.htmlEncode(danmakuData.text),
      color: danmakuData.color,
      type: danmakuData.type,
      border: `2px solid ${this.options.borderColor}`,
    };
    this.draw(danmaku);

    this.events && this.events.trigger('danmaku_send', danmakuData);
  }

  _clock() {
    const t = this.options.time();
    return Number.isFinite(t) ? t : 0;
  }

  frame() {
    if (this._destroyed) {
      return;
    }
    if (this.dan.length && !this.paused && this.showing) {
      let item = this.dan[this.danIndex];
      const dan = [];
      const clock = this._clock();
      while (item) {
        const itemT = parseFloat(item.time);
        if (!Number.isFinite(itemT)) {
          this.danIndex += 1;
          item = this.dan[this.danIndex];
          continue;
        }
        if (clock > itemT) {
          dan.push(item);
          item = this.dan[++this.danIndex];
        } else {
          break;
        }
      }
      if (dan.length) {
        this.draw(dan);
      }
    }
    this._scheduleFrame();
  }

  opacity(percentage) {
    if (this._destroyed) {
      return this._opacity;
    }
    if (percentage !== undefined) {
      const items = this.container.getElementsByClassName('wplayer-danmaku-item');
      for (let i = 0; i < items.length; i++) {
        items[i].style.opacity = percentage;
      }
      this._opacity = percentage;

      this.events && this.events.trigger('danmaku_opacity', this._opacity);
    }
    return this._opacity;
  }

  /**
   * Push a danmaku into wplayer
   *
   * @param {Object Array} dan - {text, color, type}
   * text - danmaku content
   * color - danmaku color, default: `#fff`
   * type - danmaku type, `right` `top` `bottom`, default: `right`
   */
  draw(dan) {
    if (this._destroyed) {
      return;
    }
    if (this.showing) {
      if (Object.prototype.toString.call(dan) !== '[object Array]') {
        dan = [dan];
      }
      if (!dan.length) {
        return;
      }
      const itemHeight = this.options.height;
      const danWidth = this.container.offsetWidth;
      const danHeight = this.container.offsetHeight;
      const itemY = Math.max(1, parseInt(danHeight / itemHeight, 10) || 0);

      const danItemRight = (ele) => {
        const eleWidth = ele.offsetWidth || parseInt(ele.style.width);
        const eleRight = ele.getBoundingClientRect().right || this.container.getBoundingClientRect().right + eleWidth;
        return this.container.getBoundingClientRect().right - eleRight;
      };

      const danSpeed = (width) => (danWidth + width) / 5;

      const getTunnel = (ele, type, width) => {
        const tmp = danWidth / danSpeed(width);

        for (let i = 0; this.unlimited || i < itemY; i++) {
          const item = this.danTunnel[type][i + ''];
          if (item && item.length) {
            if (type !== 'right') {
              continue;
            }
            for (let j = 0; j < item.length; j++) {
              const danRight = danItemRight(item[j]) - 10;
              if (danRight <= danWidth - tmp * danSpeed(parseInt(item[j].style.width)) || danRight <= 0) {
                break;
              }
              if (j === item.length - 1) {
                this.danTunnel[type][i + ''].push(ele);
                ele.addEventListener('animationend', () => {
                  this.danTunnel[type][i + ''].splice(0, 1);
                });
                return i % itemY;
              }
            }
          } else {
            this.danTunnel[type][i + ''] = [ele];
            ele.addEventListener('animationend', () => {
              this.danTunnel[type][i + ''].splice(0, 1);
            });
            return i % itemY;
          }
        }
        return -1;
      };

      const docFragment = document.createDocumentFragment();

      for (let i = 0; i < dan.length; i++) {
        dan[i].type =
          typeof dan[i].type === 'number' ? utils.number2Type(dan[i].type) : dan[i].type || 'right';
        if (!dan[i].color) {
          dan[i].color = 16777215;
        }
        const item = document.createElement('div');
        item.classList.add('wplayer-danmaku-item');
        item.classList.add(`wplayer-danmaku-${dan[i].type}`);
        if (dan[i].border) {
          item.innerHTML = `<span style="border:${dan[i].border}">${dan[i].text}</span>`;
        } else {
          item.innerHTML = dan[i].text;
        }
        item.style.opacity = this._opacity;
        item.style.color = utils.number2Color(dan[i].color);
        item.addEventListener('animationend', () => {
          if (item.parentNode === this.container) {
            this.container.removeChild(item);
          }
        });

        const itemWidth = this._measure(dan[i].text);
        let tunnel;

        // adjust
        switch (dan[i].type) {
          case 'right':
            tunnel = getTunnel(item, dan[i].type, itemWidth);
            if (tunnel < 0 && !this.unlimited) {
              const prevUnlimited = this.unlimited;
              this.unlimited = true;
              tunnel = getTunnel(item, dan[i].type, itemWidth);
              this.unlimited = prevUnlimited;
            }
            if (tunnel >= 0) {
              item.style.width = itemWidth + 1 + 'px';
              item.style.top = itemHeight * tunnel + 'px';
              item.style.transform = `translateX(-${danWidth}px)`;
            }
            break;
          case 'top':
            tunnel = getTunnel(item, dan[i].type);
            if (tunnel < 0 && !this.unlimited) {
              const prevUnlimited = this.unlimited;
              this.unlimited = true;
              tunnel = getTunnel(item, dan[i].type);
              this.unlimited = prevUnlimited;
            }
            if (tunnel >= 0) {
              item.style.top = itemHeight * tunnel + 'px';
            }
            break;
          case 'bottom':
            tunnel = getTunnel(item, dan[i].type);
            if (tunnel < 0 && !this.unlimited) {
              const prevUnlimited = this.unlimited;
              this.unlimited = true;
              tunnel = getTunnel(item, dan[i].type);
              this.unlimited = prevUnlimited;
            }
            if (tunnel >= 0) {
              item.style.bottom = itemHeight * tunnel + 'px';
            }
            break;
          default:
            console.error(`Can't handled danmaku type: ${dan[i].type}`);
        }

        if (tunnel >= 0) {
          // move
          item.classList.add('wplayer-danmaku-move');
          item.style.animationDuration = this._danAnimation(dan[i].type);

          // insert
          docFragment.appendChild(item);
        }
      }

      this.container.appendChild(docFragment);

      return docFragment;
    }
  }

  play() {
    this.paused = false;
  }

  pause() {
    this.paused = true;
  }

  _measure(text) {
    if (!this.context) {
      const probe = this.container.getElementsByClassName('wplayer-danmaku-item')[0] || this.container;
      const measureStyle = getComputedStyle(probe, null);
      this.context = document.createElement('canvas').getContext('2d');
      this.context.font = measureStyle.getPropertyValue('font');
    }
    return this.context.measureText(text).width;
  }

  /** 将 danIndex 指向下一条应显示的弹幕（时间轴上 first time >= 参考时刻） */
  syncReadIndexToVideoTime(clockOverride) {
    if (!this.dan.length) {
      this.danIndex = 0;
      return;
    }
    const t = Number.isFinite(clockOverride) ? clockOverride : this._clock();
    let i = 0;
    for (; i < this.dan.length; i++) {
      const it = parseFloat(this.dan[i].time);
      if (!Number.isFinite(it)) {
        continue;
      }
      if (it >= t) {
        break;
      }
    }
    this.danIndex = i;
  }

  /**
   * @param {number} [clockOverride] 与 player.seek 传入的目标时刻一致（部分浏览器上赋值 currentTime 后仍未立刻更新）
   */
  seek(clockOverride) {
    this.clear();
    this.syncReadIndexToVideoTime(clockOverride);
  }

  clear() {
    this.danTunnel = {
      right: {},
      top: {},
      bottom: {},
    };
    this.danIndex = 0;
    this.options.container.innerHTML = '';

    this.events && this.events.trigger('danmaku_clear');
  }

  htmlEncode(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/\//g, '&#x2f;');
  }

  resize() {
    const danWidth = this.container.offsetWidth;
    const items = this.container.getElementsByClassName('wplayer-danmaku-item');
    for (let i = 0; i < items.length; i++) {
      items[i].style.transform = `translateX(-${danWidth}px)`;
    }
  }

  hide() {
    this.showing = false;
    this.pause();
    this.clear();

    this.events && this.events.trigger('danmaku_hide');
  }

  show() {
    this.seek();
    this.showing = true;
    if (!this.player.video.paused) {
      this.play();
    } else {
      this.pause();
    }

    this.events && this.events.trigger('danmaku_show');
  }

  unlimit(boolean) {
    this.unlimited = boolean;
  }

  speed(rate) {
    this.options.speedRate = rate;
  }

  destroy() {
    this._destroyed = true;
    if (this._frameRafId != null) {
      cancelAnimationFrame(this._frameRafId);
      this._frameRafId = null;
    }
  }

  _danAnimation(position) {
    const rate = this.options.speedRate || 1;
    const isFullScreen = !!this.player.fullScreen.isFullScreen();
    const animations = {
      top: `${(isFullScreen ? 6 : 4) / rate}s`,
      right: `${(isFullScreen ? 8 : 5) / rate}s`,
      bottom: `${(isFullScreen ? 6 : 4) / rate}s`,
    };
    return animations[position];
  }
}

export default Danmaku;
