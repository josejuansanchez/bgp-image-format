/*
 * BPG Javascript decoder
 *
 * Copyright (c) 2014 Fabrice Bellard
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
 * THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */
window['BPGDecoder'] = function(ctx) {
    this.ctx = ctx;
    this['imageData'] = null;
    this['onload'] = null;
}

window['BPGDecoder'].prototype = {

malloc: Module['cwrap']('malloc', 'number', [ 'number' ]),

free: Module['cwrap']('free', 'void', [ 'number' ]),

bpg_decoder_open: Module['cwrap']('bpg_decoder_open', 'number', [ ]),

bpg_decoder_decode: Module['cwrap']('bpg_decoder_decode', 'number', [ 'number', 'array', 'number' ]),

bpg_decoder_get_info: Module['cwrap']('bpg_decoder_get_info', 'number', [ 'number', 'number' ]),

bpg_decoder_start: Module['cwrap']('bpg_decoder_start', 'number', [ 'number', 'number' ]),

bpg_decoder_get_line: Module['cwrap']('bpg_decoder_get_line', 'number', [ 'number', 'number' ]),

bpg_decoder_close: Module['cwrap']('bpg_decoder_close', 'void', [ 'number' ] ),

load: function(url) 
{
    var request = new XMLHttpRequest();
    var this1 = this;

    request.open("get", url, true);
    request.responseType = "arraybuffer";
    request.onload = function(event) {
        this1._onload(request, event);
    };
    request.send();
},

_onload: function(request, event)
{
    var data = request.response;
    var array = new Uint8Array(data);
    var img, w, h, img_info_buf, cimg, p0, rgba_line, w4;
    var heap8, heap32, dst, v, i, y, func;

    //    console.log("loaded " + data.byteLength + " bytes");

    img = this.bpg_decoder_open();

    if (this.bpg_decoder_decode(img, array, array.length) < 0) {
        console.log("could not decode image");
        return;
    }
    
    img_info_buf = this.malloc(6 * 4);
    this.bpg_decoder_get_info(img, img_info_buf);
    /* extract the image info */
    heap32 = Module['HEAPU32'];
    w = heap32[img_info_buf >> 2];
    h = heap32[(img_info_buf + 4) >> 2];
    this.free(img_info_buf);

//    console.log("image " + w + " " + h);
    
    /* select RGBA32 output */
    this.bpg_decoder_start(img, 1);

    rgba_line = this.malloc(w * 4);
    cimg = this.ctx.createImageData(w, h);
    dst = cimg.data;
    p0 = 0;
    heap8 = Module['HEAPU8'];
    w4 = w * 4;
    for(y = 0; y < h; y++) {
        this.bpg_decoder_get_line(img, rgba_line);
        for(i = 0; i < w4; i++) {
            dst[p0++] = heap8[rgba_line + i];
        }
    }

    this.free(rgba_line);

    this.bpg_decoder_close(img);

    this['imageData'] = cimg;
    
    if (this['onload'])
        this['onload']();
}

};

window.onload = function() { 
    var i, n, el, tab, tab1, url, dec, canvas, id, style, ctx;

    /* put all images to load in a separate array */
    tab = document.images;
    n = tab.length;
    tab1 = [];
    for(i = 0; i < n; i++) {
        el = tab[i];
        url = el.src;
        if (url.substr(-4,4).toLowerCase() == ".bpg") {
            tab1[tab1.length] = el;
        }
    }

    /* change the tags to canvas */
    n = tab1.length;
    for(i = 0; i < n; i++) {
        el = tab1[i];
        url = el.src;
        canvas = document.createElement("canvas");
        canvas.id = el.id;
        canvas.className = el.className;
        el.parentNode.replaceChild(canvas, el);

        ctx = canvas.getContext("2d");
        dec = new BPGDecoder(ctx);
        dec.onload = (function(canvas, ctx) {
            var imageData = this['imageData'];
            /* resize the canvas to the image size */
            if (canvas.style.width === "") 
                canvas.width = imageData.width;
            if (canvas.style.height === "") 
                canvas.height = imageData.height;

            /* draw the image */
            ctx.putImageData(imageData, 0, 0);
        }).bind(dec, canvas, ctx);
        dec.load(url);
    }
};
