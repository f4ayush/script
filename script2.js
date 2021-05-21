/*!
 * canvg.js - Javascript SVG parser and renderer on Canvas
 * MIT Licensed
 * Gabe Lerner (gabelerner@gmail.com)
 * http://code.google.com/p/canvg/
 *
 * Requires: rgbcolor.js - http://www.phpied.com/rgb-color-parser-in-javascript/
 */
(function () {
  // canvg(target, s)
  // empty parameters: replace all 'svg' elements on page with 'canvas' elements
  // target: canvas element or the id of a canvas element
  // s: svg string, url to svg file, or xml document
  // opts: optional hash of options
  //		 ignoreMouse: true => ignore mouse events
  //		 ignoreAnimation: true => ignore animations
  //		 ignoreDimensions: true => does not try to resize canvas
  //		 ignoreClear: true => does not clear canvas
  //		 offsetX: int => draws at a x offset
  //		 offsetY: int => draws at a y offset
  //		 scaleWidth: int => scales horizontally to width
  //		 scaleHeight: int => scales vertically to height
  //		 renderCallback: function => will call the function after the first render is completed
  //		 forceRedraw: function => will call the function on every frame, if it returns true, will redraw
  var fontUrl =
    baseURL +
    "components/com_sessioncreatorv1/assets/js/neue-haas-grotesk-display-pro-cufonfonts-webfont/style.css";
  var head = document.getElementsByTagName("HEAD")[0];

  // Create new link Element
  var link = document.createElement("link");

  // set the attributes for link element
  link.rel = "stylesheet";

  link.type = "text/css";

  link.href = fontUrl;
  head.appendChild(link);

  // var f = new FontFace("Neue", "url(neue-haas-grotesk-display-pro-cufonfonts-webfont/NeueHaasDisplayBold.woff)", {});
  //   f.load().then(function (loadedFace) {
  //     document.fonts.add(loadedFace);
  // });
  this.canvg = function (target, s, opts) {
    // to set visible canvas as target
    console.log('canvg1' + s)
    if (target.indexOf("canvas_") !== -1) {
      target = $(".canvas:visible").attr("id");
    }
    // no parameters
    if (target == null && s == null && opts == null) {
      var svgTags = document.getElementsByTagName("svg");
      for (var i = 0; i < svgTags.length; i++) {
        var svgTag = svgTags[i];
        var c = document.createElement("canvas");
        c.width = svgTag.clientWidth;
        c.height = svgTag.clientHeight;
        svgTag.parentNode.insertBefore(c, svgTag);
        svgTag.parentNode.removeChild(svgTag);
        var div = document.createElement("div");
        div.appendChild(svgTag);
        canvg(c, div.innerHTML);
      }
      return;
    }
    opts = opts || {};

    if (typeof target == "string") {
      target = document.getElementById(target);
    }

    // store class on canvas
    if (target.svg != null) target.svg.stop();
    var svg = build();
    // on i.e. 8 for flash canvas, we can't assign the property so check for it
    if (
      !(
        target.childNodes.length == 1 &&
        target.childNodes[0].nodeName == "OBJECT"
      )
    )
      target.svg = svg;
    svg.opts = opts;

    var ctx = target.getContext("2d");
    var sv = s.trim();
    if (typeof sv.documentElement != "undefined") {
      // load from xml doc
      svg.loadXmlDoc(ctx, s);
    } else if (sv.substr(0, 1) == "<") {
      // load from xml string

      svg.loadXml(ctx, s);
    } else {
      // load from url
      svg.load(ctx, s);
    }
  };

  function build() {
    var svg = {};

    svg.FRAMERATE = 30;
    svg.MAX_VIRTUAL_PIXELS = 30000;

    // globals
    svg.init = function (ctx) {
      console.log('canvg2')
      var uniqueId = 0;
      svg.UniqueId = function () {
        uniqueId++;
        return "canvg" + uniqueId;
      };
      svg.Definitions = {};
      svg.Styles = {};
      svg.Animations = [];
      svg.Images = [];
      svg.ctx = ctx;
      svg.ViewPort = new (function () {
        this.viewPorts = [];
        this.Clear = function () {
          this.viewPorts = [];
        };
        this.SetCurrent = function (width, height) {
          this.viewPorts.push({ width: width, height: height });
        };
        this.RemoveCurrent = function () {
          this.viewPorts.pop();
        };
        this.Current = function () {
          return this.viewPorts[this.viewPorts.length - 1];
        };
        this.width = function () {
          return this.Current().width;
        };
        this.height = function () {
          return this.Current().height;
        };
        this.ComputeSize = function (d) {
          if (d != null && typeof d == "number") return d;
          if (d == "x") return this.width();
          if (d == "y") return this.height();
          return (
            Math.sqrt(Math.pow(this.width(), 2) + Math.pow(this.height(), 2)) /
            Math.sqrt(2)
          );
        };
      })();
    };
    svg.init();

    // images loaded
    svg.ImagesLoaded = function () {
      for (var i = 0; i < svg.Images.length; i++) {
        if (!svg.Images[i].loaded) return false;
      }
      return true;
    };

    // trim
    svg.trim = function (s) {
      return s.replace(/^\s+|\s+$/g, "");
    };

    // compress spaces
    svg.compressSpaces = function (s) {
      return s.replace(/[\s\r\t\n]+/gm, " ");
    };

    // ajax
    svg.ajax = function (url) {
      var AJAX;
      if (window.XMLHttpRequest) {
        AJAX = new XMLHttpRequest();
      } else {
        AJAX = new ActiveXObject("Microsoft.XMLHTTP");
      }
      if (AJAX) {
        AJAX.open("GET", url, false);
        AJAX.send(null);
        return AJAX.responseText;
      }
      return null;
    };

    // parse xml
    svg.parseXml = function (xml) {
      if (window.DOMParser) {
        var parser = new DOMParser();
        return parser.parseFromString(xml, "text/xml");
      } else {
        xml = xml.replace(/<!DOCTYPE svg[^>]*>/, "");
        var xmlDoc = new ActiveXObject("Microsoft.XMLDOM");
        xmlDoc.async = "false";
        xmlDoc.loadXML(xml);
        return xmlDoc;
      }
    };

    svg.Property = function (name, value) {
      this.name = name;
      this.value = value;
    };
    svg.Property.prototype.getValue = function () {
      return this.value;
    };

    svg.Property.prototype.hasValue = function () {
      return this.value != null && this.value !== "";
    };

    // return the numerical value of the property
    svg.Property.prototype.numValue = function () {
      if (!this.hasValue()) return 0;

      var n = parseFloat(this.value);
      if ((this.value + "").match(/%$/)) {
        n = n / 100.0;
      }
      return n;
    };

    svg.Property.prototype.valueOrDefault = function (def) {
      if (this.hasValue()) return this.value;
      return def;
    };

    svg.Property.prototype.numValueOrDefault = function (def) {
      if (this.hasValue()) return this.numValue();
      return def;
    };

    // color extensions
    // augment the current color value with the opacity
    svg.Property.prototype.addOpacity = function (opacity) {
      var newValue = this.value;
      if (opacity != null && opacity != "" && typeof this.value == "string") {
        // can only add opacity to colors, not patterns
        var color = new RGBColor(this.value);
        if (color.ok) {
          newValue =
            "rgba(" +
            color.r +
            ", " +
            color.g +
            ", " +
            color.b +
            ", " +
            opacity +
            ")";
        }
      }
      return new svg.Property(this.name, newValue);
    };

    // definition extensions
    // get the definition from the definitions table
    svg.Property.prototype.getDefinition = function () {
      var name = this.value.match(/#([^\)'"]+)/);
      if (name) {
        name = name[1];
      }
      if (!name) {
        name = this.value;
      }
      return svg.Definitions[name];
    };

    svg.Property.prototype.isUrlDefinition = function () {
      return this.value.indexOf("url(") == 0;
    };

    svg.Property.prototype.getFillStyleDefinition = function (e, opacityProp) {
      var def = this.getDefinition();

      // gradient
      if (def != null && def.createGradient) {
        return def.createGradient(svg.ctx, e, opacityProp);
      }

      // pattern
      if (def != null && def.createPattern) {
        if (def.getHrefAttribute().hasValue()) {
          var pt = def.attribute("patternTransform");
          def = def.getHrefAttribute().getDefinition();
          if (pt.hasValue()) {
            def.attribute("patternTransform", true).value = pt.value;
          }
        }
        return def.createPattern(svg.ctx, e);
      }

      return null;
    };

    // length extensions
    svg.Property.prototype.getDPI = function (viewPort) {
      return 96.0; // TODO: compute?
    };

    svg.Property.prototype.getEM = function (viewPort) {
      var em = 12;

      var fontSize = new svg.Property(
        "fontSize",
        svg.Font.Parse(svg.ctx.font).fontSize
      );
      if (fontSize.hasValue()) em = fontSize.toPixels(viewPort);

      return em;
    };

    svg.Property.prototype.getUnits = function () {
      var s = this.value + "";
      return s.replace(/[0-9\.\-]/g, "");
    };

    // get the length as pixels
    svg.Property.prototype.toPixels = function (viewPort, processPercent) {
      if (!this.hasValue()) return 0;
      var s = this.value + "";
      if (s.match(/em$/)) return this.numValue() * this.getEM(viewPort);
      if (s.match(/ex$/)) return (this.numValue() * this.getEM(viewPort)) / 2.0;
      if (s.match(/px$/)) return this.numValue();
      if (s.match(/pt$/))
        return this.numValue() * this.getDPI(viewPort) * (1.0 / 72.0);
      if (s.match(/pc$/)) return this.numValue() * 15;
      if (s.match(/cm$/))
        return (this.numValue() * this.getDPI(viewPort)) / 2.54;
      if (s.match(/mm$/))
        return (this.numValue() * this.getDPI(viewPort)) / 25.4;
      if (s.match(/in$/)) return this.numValue() * this.getDPI(viewPort);
      if (s.match(/%$/))
        return this.numValue() * svg.ViewPort.ComputeSize(viewPort);
      var n = this.numValue();
      if (processPercent && n < 1.0)
        return n * svg.ViewPort.ComputeSize(viewPort);
      return n;
    };

    // time extensions
    // get the time as milliseconds
    svg.Property.prototype.toMilliseconds = function () {
      if (!this.hasValue()) return 0;
      var s = this.value + "";
      if (s.match(/s$/)) return this.numValue() * 1000;
      if (s.match(/ms$/)) return this.numValue();
      return this.numValue();
    };

    // angle extensions
    // get the angle as radians
    svg.Property.prototype.toRadians = function () {
      if (!this.hasValue()) return 0;
      var s = this.value + "";
      if (s.match(/deg$/)) return this.numValue() * (Math.PI / 180.0);
      if (s.match(/grad$/)) return this.numValue() * (Math.PI / 200.0);
      if (s.match(/rad$/)) return this.numValue();
      return this.numValue() * (Math.PI / 180.0);
    };

    // fonts
    svg.Font = new (function () {
      this.Styles = "normal|italic|oblique|inherit";
      this.Variants = "normal|small-caps|inherit";
      this.Weights =
        "normal|bold|bolder|lighter|100|200|300|400|500|600|700|800|900|inherit";

      this.CreateFont = function (
        fontStyle,
        fontVariant,
        fontWeight,
        fontSize,
        fontFamily,
        inherit
      ) {
        var f =
          inherit != null
            ? this.Parse(inherit)
            : this.CreateFont("", "", "", "", "", "Neue Haas Grotesk Display Pro");
        return {
          fontFamily: fontFamily || f.fontFamily,
          fontSize:  fontSize || f.fontSize,
          fontStyle: fontStyle || f.fontStyle,
          fontWeight: fontWeight || f.fontWeight,
          fontVariant: fontVariant || f.fontVariant,
          toString: function () {
            return [
              this.fontStyle,
              this.fontVariant,
              this.fontWeight,
              this.fontSize,
              this.fontFamily,
            ].join(" ");
          },
        };
      };

      var that = this;
      this.Parse = function (s) {
        var f = {};
        var d = svg.trim(svg.compressSpaces(s || "")).split(" ");
        var set = {
          fontSize: false,
          fontStyle: false,
          fontWeight: false,
          fontVariant: false,
        };
        var ff = "";
        for (var i = 0; i < d.length; i++) {
          if (!set.fontStyle && that.Styles.indexOf(d[i]) != -1) {
            if (d[i] != "inherit") f.fontStyle = d[i];
            set.fontStyle = true;
          } else if (!set.fontVariant && that.Variants.indexOf(d[i]) != -1) {
            if (d[i] != "inherit") f.fontVariant = d[i];
            set.fontStyle = set.fontVariant = true;
          } else if (!set.fontWeight && that.Weights.indexOf(d[i]) != -1) {
            if (d[i] != "inherit") f.fontWeight = d[i];
            set.fontStyle = set.fontVariant = set.fontWeight = true;
          } else if (!set.fontSize) {
            if (d[i] != "inherit") f.fontSize = d[i].split("/")[0];
            set.fontStyle = set.fontVariant = set.fontWeight = set.fontSize = true;
          } else {
            if (d[i] != "inherit") ff += d[i];
          }
        }
        if (ff != "") f.fontFamily = ff;
        return f;
      };
    })();

    // points and paths
    svg.ToNumberArray = function (s) {
      var a = svg
        .trim(svg.compressSpaces((s || "").replace(/,/g, " ")))
        .split(" ");
      for (var i = 0; i < a.length; i++) {
        a[i] = parseFloat(a[i]);
      }
      return a;
    };
    svg.Point = function (x, y) {
      this.x = x;
      this.y = y;
    };
    svg.Point.prototype.angleTo = function (p) {
      return Math.atan2(p.y - this.y, p.x - this.x);
    };

    svg.Point.prototype.applyTransform = function (v) {
      var xp = this.x * v[0] + this.y * v[2] + v[4];
      var yp = this.x * v[1] + this.y * v[3] + v[5];
      this.x = xp;
      this.y = yp;
    };

    svg.CreatePoint = function (s) {
      var a = svg.ToNumberArray(s);
      return new svg.Point(a[0], a[1]);
    };
    svg.CreatePath = function (s) {
      var a = svg.ToNumberArray(s);
      var path = [];
      for (var i = 0; i < a.length; i += 2) {
        path.push(new svg.Point(a[i], a[i + 1]));
      }
      return path;
    };

    // bounding box
    svg.BoundingBox = function (x1, y1, x2, y2) {
      // pass in initial points if you want
      this.x1 = Number.NaN;
      this.y1 = Number.NaN;
      this.x2 = Number.NaN;
      this.y2 = Number.NaN;

      this.x = function () {
        return this.x1;
      };
      this.y = function () {
        return this.y1;
      };
      this.width = function () {
        return this.x2 - this.x1;
      };
      this.height = function () {
        return this.y2 - this.y1;
      };

      this.addPoint = function (x, y) {
        if (x != null) {
          if (isNaN(this.x1) || isNaN(this.x2)) {
            this.x1 = x;
            this.x2 = x;
          }
          if (x < this.x1) this.x1 = x;
          if (x > this.x2) this.x2 = x;
        }

        if (y != null) {
          if (isNaN(this.y1) || isNaN(this.y2)) {
            this.y1 = y;
            this.y2 = y;
          }
          if (y < this.y1) this.y1 = y;
          if (y > this.y2) this.y2 = y;
        }
      };
      this.addX = function (x) {
        this.addPoint(x, null);
      };
      this.addY = function (y) {
        this.addPoint(null, y);
      };

      this.addBoundingBox = function (bb) {
        this.addPoint(bb.x1, bb.y1);
        this.addPoint(bb.x2, bb.y2);
      };

      this.addQuadraticCurve = function (p0x, p0y, p1x, p1y, p2x, p2y) {
        var cp1x = p0x + (2 / 3) * (p1x - p0x); // CP1 = QP0 + 2/3 *(QP1-QP0)
        var cp1y = p0y + (2 / 3) * (p1y - p0y); // CP1 = QP0 + 2/3 *(QP1-QP0)
        var cp2x = cp1x + (1 / 3) * (p2x - p0x); // CP2 = CP1 + 1/3 *(QP2-QP0)
        var cp2y = cp1y + (1 / 3) * (p2y - p0y); // CP2 = CP1 + 1/3 *(QP2-QP0)
        this.addBezierCurve(p0x, p0y, cp1x, cp2x, cp1y, cp2y, p2x, p2y);
      };

      this.addBezierCurve = function (p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y) {
        // from http://blog.hackers-cafe.net/2009/06/how-to-calculate-bezier-curves-bounding.html
        var p0 = [p0x, p0y],
          p1 = [p1x, p1y],
          p2 = [p2x, p2y],
          p3 = [p3x, p3y];
        this.addPoint(p0[0], p0[1]);
        this.addPoint(p3[0], p3[1]);

        for (i = 0; i <= 1; i++) {
          var f = function (t) {
            return (
              Math.pow(1 - t, 3) * p0[i] +
              3 * Math.pow(1 - t, 2) * t * p1[i] +
              3 * (1 - t) * Math.pow(t, 2) * p2[i] +
              Math.pow(t, 3) * p3[i]
            );
          };

          var b = 6 * p0[i] - 12 * p1[i] + 6 * p2[i];
          var a = -3 * p0[i] + 9 * p1[i] - 9 * p2[i] + 3 * p3[i];
          var c = 3 * p1[i] - 3 * p0[i];

          if (a == 0) {
            if (b == 0) continue;
            var t = -c / b;
            if (0 < t && t < 1) {
              if (i == 0) this.addX(f(t));
              if (i == 1) this.addY(f(t));
            }
            continue;
          }

          var b2ac = Math.pow(b, 2) - 4 * c * a;
          if (b2ac < 0) continue;
          var t1 = (-b + Math.sqrt(b2ac)) / (2 * a);
          if (0 < t1 && t1 < 1) {
            if (i == 0) this.addX(f(t1));
            if (i == 1) this.addY(f(t1));
          }
          var t2 = (-b - Math.sqrt(b2ac)) / (2 * a);
          if (0 < t2 && t2 < 1) {
            if (i == 0) this.addX(f(t2));
            if (i == 1) this.addY(f(t2));
          }
        }
      };

      this.isPointInBox = function (x, y) {
        return this.x1 <= x && x <= this.x2 && this.y1 <= y && y <= this.y2;
      };

      this.addPoint(x1, y1);
      this.addPoint(x2, y2);
    };

    // transforms
    svg.Transform = function (v) {
      var that = this;
      this.Type = {};

      // translate
      this.Type.translate = function (s) {
        this.p = svg.CreatePoint(s);
        this.apply = function (ctx) {
          ctx.translate(this.p.x || 0.0, this.p.y || 0.0);
        };
        this.unapply = function (ctx) {
          ctx.translate(-1.0 * this.p.x || 0.0, -1.0 * this.p.y || 0.0);
        };
        this.applyToPoint = function (p) {
          p.applyTransform([1, 0, 0, 1, this.p.x || 0.0, this.p.y || 0.0]);
        };
      };

      // rotate
      this.Type.rotate = function (s) {
        var a = svg.ToNumberArray(s);
        this.angle = new svg.Property("angle", a[0]);
        this.cx = a[1] || 0;
        this.cy = a[2] || 0;
        this.apply = function (ctx) {
          ctx.translate(this.cx, this.cy);
          ctx.rotate(this.angle.toRadians());
          ctx.translate(-this.cx, -this.cy);
        };
        this.unapply = function (ctx) {
          ctx.translate(this.cx, this.cy);
          ctx.rotate(-1.0 * this.angle.toRadians());
          ctx.translate(-this.cx, -this.cy);
        };
        this.applyToPoint = function (p) {
          var a = this.angle.toRadians();
          p.applyTransform([1, 0, 0, 1, this.p.x || 0.0, this.p.y || 0.0]);
          p.applyTransform([
            Math.cos(a),
            Math.sin(a),
            -Math.sin(a),
            Math.cos(a),
            0,
            0,
          ]);
          p.applyTransform([1, 0, 0, 1, -this.p.x || 0.0, -this.p.y || 0.0]);
        };
      };

      this.Type.scale = function (s) {
        this.p = svg.CreatePoint(s);
        this.apply = function (ctx) {
          ctx.scale(this.p.x || 1.0, this.p.y || this.p.x || 1.0);
        };
        this.unapply = function (ctx) {
          ctx.scale(1.0 / this.p.x || 1.0, 1.0 / this.p.y || this.p.x || 1.0);
        };
        this.applyToPoint = function (p) {
          p.applyTransform([this.p.x || 0.0, 0, 0, this.p.y || 0.0, 0, 0]);
        };
      };

      this.Type.matrix = function (s) {
        this.m = svg.ToNumberArray(s);
        this.apply = function (ctx) {
          ctx.transform(
            this.m[0],
            this.m[1],
            this.m[2],
            this.m[3],
            this.m[4],
            this.m[5]
          );
        };
        this.applyToPoint = function (p) {
          p.applyTransform(this.m);
        };
      };

      this.Type.SkewBase = function (s) {
        this.base = that.Type.matrix;
        this.base(s);
        this.angle = new svg.Property("angle", s);
      };
      this.Type.SkewBase.prototype = new this.Type.matrix();

      this.Type.skewX = function (s) {
        this.base = that.Type.SkewBase;
        this.base(s);
        this.m = [1, 0, Math.tan(this.angle.toRadians()), 1, 0, 0];
      };
      this.Type.skewX.prototype = new this.Type.SkewBase();

      this.Type.skewY = function (s) {
        this.base = that.Type.SkewBase;
        this.base(s);
        this.m = [1, Math.tan(this.angle.toRadians()), 0, 1, 0, 0];
      };
      this.Type.skewY.prototype = new this.Type.SkewBase();

      this.transforms = [];

      this.apply = function (ctx) {
        for (var i = 0; i < this.transforms.length; i++) {
          this.transforms[i].apply(ctx);
        }
      };

      this.unapply = function (ctx) {
        for (var i = this.transforms.length - 1; i >= 0; i--) {
          this.transforms[i].unapply(ctx);
        }
      };

      this.applyToPoint = function (p) {
        for (var i = 0; i < this.transforms.length; i++) {
          this.transforms[i].applyToPoint(p);
        }
      };

      var data = svg
        .trim(svg.compressSpaces(v))
        .replace(/\)(\s?,\s?)/g, ") ")
        .split(/\s(?=[a-z])/);
      for (var i = 0; i < data.length; i++) {
        var type = svg.trim(data[i].split("(")[0]);
        var s = data[i].split("(")[1].replace(")", "");
        var transform = new this.Type[type](s);
        transform.type = type;
        this.transforms.push(transform);
      }
    };

    // aspect ratio
    svg.AspectRatio = function (
      ctx,
      aspectRatio,
      width,
      desiredWidth,
      height,
      desiredHeight,
      minX,
      minY,
      refX,
      refY
    ) {
      // aspect ratio - http://www.w3.org/TR/SVG/coords.html#PreserveAspectRatioAttribute
      aspectRatio = svg.compressSpaces(aspectRatio);
      aspectRatio = aspectRatio.replace(/^defer\s/, ""); // ignore defer
      var align = aspectRatio.split(" ")[0] || "xMidYMid";
      var meetOrSlice = aspectRatio.split(" ")[1] || "meet";

      // calculate scale
      var scaleX = width / desiredWidth;
      var scaleY = height / desiredHeight;
      var scaleMin = Math.min(scaleX, scaleY);
      var scaleMax = Math.max(scaleX, scaleY);
      if (meetOrSlice == "meet") {
        desiredWidth *= scaleMin;
        desiredHeight *= scaleMin;
      }
      if (meetOrSlice == "slice") {
        desiredWidth *= scaleMax;
        desiredHeight *= scaleMax;
      }

      refX = new svg.Property("refX", refX);
      refY = new svg.Property("refY", refY);
      if (refX.hasValue() && refY.hasValue()) {
        ctx.translate(
          -scaleMin * refX.toPixels("x"),
          -scaleMin * refY.toPixels("y")
        );
      } else {
        // align
        if (
          align.match(/^xMid/) &&
          ((meetOrSlice == "meet" && scaleMin == scaleY) ||
            (meetOrSlice == "slice" && scaleMax == scaleY))
        )
          ctx.translate(width / 2.0 - desiredWidth / 2.0, 0);
        if (
          align.match(/YMid$/) &&
          ((meetOrSlice == "meet" && scaleMin == scaleX) ||
            (meetOrSlice == "slice" && scaleMax == scaleX))
        )
          ctx.translate(0, height / 2.0 - desiredHeight / 2.0);
        if (
          align.match(/^xMax/) &&
          ((meetOrSlice == "meet" && scaleMin == scaleY) ||
            (meetOrSlice == "slice" && scaleMax == scaleY))
        )
          ctx.translate(width - desiredWidth, 0);
        if (
          align.match(/YMax$/) &&
          ((meetOrSlice == "meet" && scaleMin == scaleX) ||
            (meetOrSlice == "slice" && scaleMax == scaleX))
        )
          ctx.translate(0, height - desiredHeight);
      }

      // scale
      if (align == "none") ctx.scale(scaleX, scaleY);
      else if (meetOrSlice == "meet") ctx.scale(scaleMin, scaleMin);
      else if (meetOrSlice == "slice") ctx.scale(scaleMax, scaleMax);

      // translate
      ctx.translate(minX == null ? 0 : -minX, minY == null ? 0 : -minY);
    };

    // elements
    svg.Element = {};

    svg.EmptyProperty = new svg.Property("EMPTY", "");

    svg.Element.ElementBase = function (node) {
      this.attributes = {};
      this.styles = {};
      this.children = [];

      // get or create attribute
      this.attribute = function (name, createIfNotExists) {
        var a = this.attributes[name];
        if (a != null) return a;

        if (createIfNotExists == true) {
          a = new svg.Property(name, "");
          this.attributes[name] = a;
        }
        return a || svg.EmptyProperty;
      };

      this.getHrefAttribute = function () {
        for (var a in this.attributes) {
          if (a.match(/:href$/)) {
            return this.attributes[a];
          }
        }
        return svg.EmptyProperty;
      };

      // get or create style, crawls up node tree
      this.style = function (name, createIfNotExists) {
        var s = this.styles[name];
        if (s != null) return s;

        var a = this.attribute(name);
        if (a != null && a.hasValue()) {
          this.styles[name] = a; // move up to me to cache
          return a;
        }

        var p = this.parent;
        if (p != null) {
          var ps = p.style(name);
          if (ps != null && ps.hasValue()) {
            return ps;
          }
        }

        if (createIfNotExists == true) {
          s = new svg.Property(name, "");
          this.styles[name] = s;
        }
        return s || svg.EmptyProperty;
      };

      // base render
      this.render = function (ctx) {
        // don't render display=none
        if (this.style("display").value == "none") return;

        // don't render visibility=hidden
        if (this.attribute("visibility").value == "hidden") return;

        ctx.save();
        if (this.attribute("mask").hasValue()) {
          // mask
          var mask = this.attribute("mask").getDefinition();
          if (mask != null) mask.apply(ctx, this);
        } else if (this.style("filter").hasValue()) {
          // filter
          var filter = this.style("filter").getDefinition();
          if (filter != null) filter.apply(ctx, this);
        } else {
          this.setContext(ctx);
          this.renderChildren(ctx);
          this.clearContext(ctx);
        }
        ctx.restore();
      };

      // base set context
      this.setContext = function (ctx) {
        // OVERRIDE ME!
      };

      // base clear context
      this.clearContext = function (ctx) {
        // OVERRIDE ME!
      };

      // base render children
      this.renderChildren = function (ctx) {
        for (var i = 0; i < this.children.length; i++) {
          this.children[i].render(ctx);
        }
      };

      this.addChild = function (childNode, create) {
        var child = childNode;
        if (create) child = svg.CreateElement(childNode);
        child.parent = this;
        this.children.push(child);
      };

      if (node != null && node.nodeType == 1) {
        //ELEMENT_NODE
        // add children
        for (var i = 0; i < node.childNodes.length; i++) {
          var childNode = node.childNodes[i];
          if (childNode.nodeType == 1) this.addChild(childNode, true); //ELEMENT_NODE
          if (this.captureTextNodes && childNode.nodeType == 3) {
            var text = childNode.nodeValue || childNode.text || "";
            if (svg.trim(svg.compressSpaces(text)) != "") {
              this.addChild(new svg.Element.tspan(childNode), false); // TEXT_NODE
            }
          }
        }

        // add attributes
        for (var i = 0; i < node.attributes.length; i++) {
          var attribute = node.attributes[i];
          this.attributes[attribute.nodeName] = new svg.Property(
            attribute.nodeName,
            attribute.nodeValue
          );
        }

        // add tag styles
        var styles = svg.Styles[node.nodeName];
        if (styles != null) {
          for (var name in styles) {
            this.styles[name] = styles[name];
          }
        }

        // add class styles
        if (this.attribute("class").hasValue()) {
          var classes = svg
            .compressSpaces(this.attribute("class").value)
            .split(" ");
          for (var j = 0; j < classes.length; j++) {
            styles = svg.Styles["." + classes[j]];
            if (styles != null) {
              for (var name in styles) {
                this.styles[name] = styles[name];
              }
            }
            styles = svg.Styles[node.nodeName + "." + classes[j]];
            if (styles != null) {
              for (var name in styles) {
                this.styles[name] = styles[name];
              }
            }
          }
        }

        // add id styles
        if (this.attribute("id").hasValue()) {
          var styles = svg.Styles["#" + this.attribute("id").value];
          if (styles != null) {
            for (var name in styles) {
              this.styles[name] = styles[name];
            }
          }
        }

        // add inline styles
        if (this.attribute("style").hasValue()) {
          var styles = this.attribute("style").value.split(";");
          for (var i = 0; i < styles.length; i++) {
            if (svg.trim(styles[i]) != "") {
              var style = styles[i].split(":");
              var name = svg.trim(style[0]);
              var value = svg.trim(style[1]);
              this.styles[name] = new svg.Property(name, value);
            }
          }
        }

        // add id
        if (this.attribute("id").hasValue()) {
          if (svg.Definitions[this.attribute("id").value] == null) {
            svg.Definitions[this.attribute("id").value] = this;
          }
        }
      }
    };

    svg.Element.RenderedElementBase = function (node) {
      this.base = svg.Element.ElementBase;
      this.base(node);

      this.setContext = function (ctx) {
        // fill
        if (this.style("fill").isUrlDefinition()) {
          var fs = this.style("fill").getFillStyleDefinition(
            this,
            this.style("fill-opacity")
          );
          if (fs != null) ctx.fillStyle = fs;
        } else if (this.style("fill").hasValue()) {
          var fillStyle = this.style("fill");
          if (fillStyle.value == "currentColor")
            fillStyle.value = this.style("color").value;
          ctx.fillStyle =
            fillStyle.value == "none" ? "rgba(0,0,0,0)" : fillStyle.value;
        }
        if (this.style("fill-opacity").hasValue()) {
          var fillStyle = new svg.Property("fill", ctx.fillStyle);
          fillStyle = fillStyle.addOpacity(this.style("fill-opacity").value);
          ctx.fillStyle = fillStyle.value;
        }

        // stroke
        if (this.style("stroke").isUrlDefinition()) {
          var fs = this.style("stroke").getFillStyleDefinition(
            this,
            this.style("stroke-opacity")
          );
          if (fs != null) ctx.strokeStyle = fs;
        } else if (this.style("stroke").hasValue()) {
          var strokeStyle = this.style("stroke");
          if (strokeStyle.value == "currentColor")
            strokeStyle.value = this.style("color").value;
          ctx.strokeStyle =
            strokeStyle.value == "none" ? "rgba(0,0,0,0)" : strokeStyle.value;
        }
        if (this.style("stroke-opacity").hasValue()) {
          var strokeStyle = new svg.Property("stroke", ctx.strokeStyle);
          strokeStyle = strokeStyle.addOpacity(
            this.style("stroke-opacity").value
          );
          ctx.strokeStyle = strokeStyle.value;
        }
        if (this.style("stroke-width").hasValue()) {
          var newLineWidth = this.style("stroke-width").toPixels();
          ctx.lineWidth = newLineWidth == 0 ? 0.001 : newLineWidth; // browsers don't respect 0
        }
        if (this.style("stroke-linecap").hasValue())
          ctx.lineCap = this.style("stroke-linecap").value;
        if (this.style("stroke-linejoin").hasValue())
          ctx.lineJoin = this.style("stroke-linejoin").value;
        if (this.style("stroke-miterlimit").hasValue())
          ctx.miterLimit = this.style("stroke-miterlimit").value;
        if (this.style("stroke-dasharray").hasValue()) {
          var gaps = svg.ToNumberArray(this.style("stroke-dasharray").value);
          if (typeof ctx.setLineDash != "undefined") {
            ctx.setLineDash(gaps);
          } else if (typeof ctx.webkitLineDash != "undefined") {
            ctx.webkitLineDash = gaps;
          } else if (typeof ctx.mozDash != "undefined") {
            ctx.mozDash = gaps;
          }

          var offset = this.style("stroke-dashoffset").numValueOrDefault(1);
          if (typeof ctx.lineDashOffset != "undefined") {
            ctx.lineDashOffset = offset;
          } else if (typeof ctx.webkitLineDashOffset != "undefined") {
            ctx.webkitLineDashOffset = offset;
          } else if (typeof ctx.mozDashOffset != "undefined") {
            ctx.mozDashOffset = offset;
          }
        }

        // font
        if (typeof ctx.font != "undefined") {
          ctx.font = svg.Font.CreateFont(
            this.style("font-style").value,
            this.style("font-variant").value,
            this.style("font-weight").value,
            this.style("font-size").hasValue()
              ? this.style("font-size").toPixels() + "px"
              : "",
            this.style("font-family").value
          ).toString();
        }

        // transform
        if (this.attribute("transform").hasValue()) {
          var transform = new svg.Transform(this.attribute("transform").value);
          transform.apply(ctx);
        }

        // clip
        if (this.style("clip-path").hasValue()) {
          var clip = this.style("clip-path").getDefinition();
          if (clip != null) clip.apply(ctx);
        }

        // opacity
        if (this.style("opacity").hasValue()) {
          ctx.globalAlpha = this.style("opacity").numValue();
        }
      };
    };
    svg.Element.RenderedElementBase.prototype = new svg.Element.ElementBase();

    svg.Element.PathElementBase = function (node) {
      this.base = svg.Element.RenderedElementBase;
      this.base(node);

      this.path = function (ctx) {
        if (ctx != null) ctx.beginPath();
        return new svg.BoundingBox();
      };

      this.renderChildren = function (ctx) {
        this.path(ctx);
        svg.Mouse.checkPath(this, ctx);
        if (ctx.fillStyle != "") {
          if (this.attribute("fill-rule").hasValue()) {
            ctx.fill(this.attribute("fill-rule").value);
          } else {
            ctx.fill();
          }
        }
        if (ctx.strokeStyle != "") ctx.stroke();

        var markers = this.getMarkers();
        if (markers != null) {
          if (this.style("marker-start").isUrlDefinition()) {
            var marker = this.style("marker-start").getDefinition();
            marker.render(ctx, markers[0][0], markers[0][1]);
          }
          if (this.style("marker-mid").isUrlDefinition()) {
            var marker = this.style("marker-mid").getDefinition();
            for (var i = 1; i < markers.length - 1; i++) {
              marker.render(ctx, markers[i][0], markers[i][1]);
            }
          }
          if (this.style("marker-end").isUrlDefinition()) {
            var marker = this.style("marker-end").getDefinition();
            marker.render(
              ctx,
              markers[markers.length - 1][0],
              markers[markers.length - 1][1]
            );
          }
        }
      };

      this.getBoundingBox = function () {
        return this.path();
      };

      this.getMarkers = function () {
        return null;
      };
    };
    svg.Element.PathElementBase.prototype = new svg.Element.RenderedElementBase();

    // svg element
    svg.Element.svg = function (node) {
      this.base = svg.Element.RenderedElementBase;
      this.base(node);

      this.baseClearContext = this.clearContext;
      this.clearContext = function (ctx) {
        this.baseClearContext(ctx);
        svg.ViewPort.RemoveCurrent();
      };

      this.baseSetContext = this.setContext;
      this.setContext = function (ctx) {
        // initial values
        ctx.strokeStyle = "rgba(0,0,0,0)";
        ctx.lineCap = "butt";
        ctx.lineJoin = "miter";
        ctx.miterLimit = 4;

        this.baseSetContext(ctx);

        // create new view port
        if (!this.attribute("x").hasValue())
          this.attribute("x", true).value = 0;
        if (!this.attribute("y").hasValue())
          this.attribute("y", true).value = 0;
        ctx.translate(
          this.attribute("x").toPixels("x"),
          this.attribute("y").toPixels("y")
        );

        var width = svg.ViewPort.width();
        var height = svg.ViewPort.height();

        if (!this.attribute("width").hasValue())
          this.attribute("width", true).value = "100%";
        if (!this.attribute("height").hasValue())
          this.attribute("height", true).value = "100%";
        if (typeof this.root == "undefined") {
          width = this.attribute("width").toPixels("x");
          height = this.attribute("height").toPixels("y");

          var x = 0;
          var y = 0;
          if (
            this.attribute("refX").hasValue() &&
            this.attribute("refY").hasValue()
          ) {
            x = -this.attribute("refX").toPixels("x");
            y = -this.attribute("refY").toPixels("y");
          }

          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(width, y);
          ctx.lineTo(width, height);
          ctx.lineTo(x, height);
          ctx.closePath();
          ctx.clip();
        }
        svg.ViewPort.SetCurrent(width, height);

        // viewbox
        if (this.attribute("viewBox").hasValue()) {
          var viewBox = svg.ToNumberArray(this.attribute("viewBox").value);
          var minX = viewBox[0];
          var minY = viewBox[1];
          width = viewBox[2];
          height = viewBox[3];

          svg.AspectRatio(
            ctx,
            this.attribute("preserveAspectRatio").value,
            svg.ViewPort.width(),
            width,
            svg.ViewPort.height(),
            height,
            minX,
            minY,
            this.attribute("refX").value,
            this.attribute("refY").value
          );

          svg.ViewPort.RemoveCurrent();
          svg.ViewPort.SetCurrent(viewBox[2], viewBox[3]);
        }
      };
    };
    svg.Element.svg.prototype = new svg.Element.RenderedElementBase();

    // rect element
    svg.Element.rect = function (node) {
      this.base = svg.Element.PathElementBase;
      this.base(node);

      this.path = function (ctx) {
        var x = this.attribute("x").toPixels("x");
        var y = this.attribute("y").toPixels("y");
        var width = this.attribute("width").toPixels("x");
        var height = this.attribute("height").toPixels("y");
        var rx = this.attribute("rx").toPixels("x");
        var ry = this.attribute("ry").toPixels("y");
        if (this.attribute("rx").hasValue() && !this.attribute("ry").hasValue())
          ry = rx;
        if (this.attribute("ry").hasValue() && !this.attribute("rx").hasValue())
          rx = ry;
        rx = Math.min(rx, width / 2.0);
        ry = Math.min(ry, height / 2.0);
        if (ctx != null) {
          ctx.beginPath();
          ctx.moveTo(x + rx, y);
          ctx.lineTo(x + width - rx, y);
          ctx.quadraticCurveTo(x + width, y, x + width, y + ry);
          ctx.lineTo(x + width, y + height - ry);
          ctx.quadraticCurveTo(
            x + width,
            y + height,
            x + width - rx,
            y + height
          );
          ctx.lineTo(x + rx, y + height);
          ctx.quadraticCurveTo(x, y + height, x, y + height - ry);
          ctx.lineTo(x, y + ry);
          ctx.quadraticCurveTo(x, y, x + rx, y);
          ctx.closePath();
        }

        return new svg.BoundingBox(x, y, x + width, y + height);
      };
    };
    svg.Element.rect.prototype = new svg.Element.PathElementBase();

    // circle element
    svg.Element.circle = function (node) {
      this.base = svg.Element.PathElementBase;
      this.base(node);

      this.path = function (ctx) {
        var cx = this.attribute("cx").toPixels("x");
        var cy = this.attribute("cy").toPixels("y");
        var r = this.attribute("r").toPixels();

        if (ctx != null) {
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2, true);
          ctx.closePath();
        }

        return new svg.BoundingBox(cx - r, cy - r, cx + r, cy + r);
      };
    };
    svg.Element.circle.prototype = new svg.Element.PathElementBase();

    // ellipse element
    svg.Element.ellipse = function (node) {
      this.base = svg.Element.PathElementBase;
      this.base(node);

      this.path = function (ctx) {
        var KAPPA = 4 * ((Math.sqrt(2) - 1) / 3);
        var rx = this.attribute("rx").toPixels("x");
        var ry = this.attribute("ry").toPixels("y");
        var cx = this.attribute("cx").toPixels("x");
        var cy = this.attribute("cy").toPixels("y");

        if (ctx != null) {
          ctx.beginPath();
          ctx.moveTo(cx, cy - ry);
          ctx.bezierCurveTo(
            cx + KAPPA * rx,
            cy - ry,
            cx + rx,
            cy - KAPPA * ry,
            cx + rx,
            cy
          );
          ctx.bezierCurveTo(
            cx + rx,
            cy + KAPPA * ry,
            cx + KAPPA * rx,
            cy + ry,
            cx,
            cy + ry
          );
          ctx.bezierCurveTo(
            cx - KAPPA * rx,
            cy + ry,
            cx - rx,
            cy + KAPPA * ry,
            cx - rx,
            cy
          );
          ctx.bezierCurveTo(
            cx - rx,
            cy - KAPPA * ry,
            cx - KAPPA * rx,
            cy - ry,
            cx,
            cy - ry
          );
          ctx.closePath();
        }

        return new svg.BoundingBox(cx - rx, cy - ry, cx + rx, cy + ry);
      };
    };
    svg.Element.ellipse.prototype = new svg.Element.PathElementBase();

    // line element
    svg.Element.line = function (node) {
      this.base = svg.Element.PathElementBase;
      this.base(node);

      this.getPoints = function () {
        return [
          new svg.Point(
            this.attribute("x1").toPixels("x"),
            this.attribute("y1").toPixels("y")
          ),
          new svg.Point(
            this.attribute("x2").toPixels("x"),
            this.attribute("y2").toPixels("y")
          ),
        ];
      };

      this.path = function (ctx) {
        var points = this.getPoints();

        if (ctx != null) {
          ctx.beginPath();
          ctx.moveTo(points[0].x, points[0].y);
          ctx.lineTo(points[1].x, points[1].y);
        }

        return new svg.BoundingBox(
          points[0].x,
          points[0].y,
          points[1].x,
          points[1].y
        );
      };

      this.getMarkers = function () {
        var points = this.getPoints();
        var a = points[0].angleTo(points[1]);
        return [
          [points[0], a],
          [points[1], a],
        ];
      };
    };
    svg.Element.line.prototype = new svg.Element.PathElementBase();

    // polyline element
    svg.Element.polyline = function (node) {
      this.base = svg.Element.PathElementBase;
      this.base(node);

      this.points = svg.CreatePath(this.attribute("points").value);
      this.path = function (ctx) {
        var bb = new svg.BoundingBox(this.points[0].x, this.points[0].y);
        if (ctx != null) {
          ctx.beginPath();
          ctx.moveTo(this.points[0].x, this.points[0].y);
        }
        for (var i = 1; i < this.points.length; i++) {
          bb.addPoint(this.points[i].x, this.points[i].y);
          if (ctx != null) ctx.lineTo(this.points[i].x, this.points[i].y);
        }
        return bb;
      };

      this.getMarkers = function () {
        var markers = [];
        for (var i = 0; i < this.points.length - 1; i++) {
          markers.push([
            this.points[i],
            this.points[i].angleTo(this.points[i + 1]),
          ]);
        }
        markers.push([
          this.points[this.points.length - 1],
          markers[markers.length - 1][1],
        ]);
        return markers;
      };
    };
    svg.Element.polyline.prototype = new svg.Element.PathElementBase();

    // polygon element
    svg.Element.polygon = function (node) {
      this.base = svg.Element.polyline;
      this.base(node);

      this.basePath = this.path;
      this.path = function (ctx) {
        var bb = this.basePath(ctx);
        if (ctx != null) {
          ctx.lineTo(this.points[0].x, this.points[0].y);
          ctx.closePath();
        }
        return bb;
      };
    };
    svg.Element.polygon.prototype = new svg.Element.polyline();

    // path element
    svg.Element.path = function (node) {
      this.base = svg.Element.PathElementBase;
      this.base(node);

      var d = this.attribute("d").value;
      // TODO: convert to real lexer based on http://www.w3.org/TR/SVG11/paths.html#PathDataBNF
      d = d.replace(/,/gm, " "); // get rid of all commas
      d = d.replace(
        /([MmZzLlHhVvCcSsQqTtAa])([MmZzLlHhVvCcSsQqTtAa])/gm,
        "$1 $2"
      ); // separate commands from commands
      d = d.replace(
        /([MmZzLlHhVvCcSsQqTtAa])([MmZzLlHhVvCcSsQqTtAa])/gm,
        "$1 $2"
      ); // separate commands from commands
      d = d.replace(/([MmZzLlHhVvCcSsQqTtAa])([^\s])/gm, "$1 $2"); // separate commands from points
      d = d.replace(/([^\s])([MmZzLlHhVvCcSsQqTtAa])/gm, "$1 $2"); // separate commands from points
      d = d.replace(/([0-9])([+\-])/gm, "$1 $2"); // separate digits when no comma
      d = d.replace(/(\.[0-9]*)(\.)/gm, "$1 $2"); // separate digits when no comma
      d = d.replace(/([Aa](\s+[0-9]+){3})\s+([01])\s*([01])/gm, "$1 $3 $4 "); // shorthand elliptical arc path syntax
      d = svg.compressSpaces(d); // compress multiple spaces
      d = svg.trim(d);
      this.PathParser = new (function (d) {
        this.tokens = d.split(" ");

        this.reset = function () {
          this.i = -1;
          this.command = "";
          this.previousCommand = "";
          this.start = new svg.Point(0, 0);
          this.control = new svg.Point(0, 0);
          this.current = new svg.Point(0, 0);
          this.points = [];
          this.angles = [];
        };

        this.isEnd = function () {
          return this.i >= this.tokens.length - 1;
        };

        this.isCommandOrEnd = function () {
          if (this.isEnd()) return true;
          return this.tokens[this.i + 1].match(/^[A-Za-z]$/) != null;
        };

        this.isRelativeCommand = function () {
          switch (this.command) {
            case "m":
            case "l":
            case "h":
            case "v":
            case "c":
            case "s":
            case "q":
            case "t":
            case "a":
            case "z":
              return true;
              break;
          }
          return false;
        };

        this.getToken = function () {
          this.i++;
          return this.tokens[this.i];
        };

        this.getScalar = function () {
          return parseFloat(this.getToken());
        };

        this.nextCommand = function () {
          this.previousCommand = this.command;
          this.command = this.getToken();
        };

        this.getPoint = function () {
          var p = new svg.Point(this.getScalar(), this.getScalar());
          return this.makeAbsolute(p);
        };

        this.getAsControlPoint = function () {
          var p = this.getPoint();
          this.control = p;
          return p;
        };

        this.getAsCurrentPoint = function () {
          var p = this.getPoint();
          this.current = p;
          return p;
        };

        this.getReflectedControlPoint = function () {
          if (
            this.previousCommand.toLowerCase() != "c" &&
            this.previousCommand.toLowerCase() != "s" &&
            this.previousCommand.toLowerCase() != "q" &&
            this.previousCommand.toLowerCase() != "t"
          ) {
            return this.current;
          }

          // reflect point
          var p = new svg.Point(
            2 * this.current.x - this.control.x,
            2 * this.current.y - this.control.y
          );
          return p;
        };

        this.makeAbsolute = function (p) {
          if (this.isRelativeCommand()) {
            p.x += this.current.x;
            p.y += this.current.y;
          }
          return p;
        };

        this.addMarker = function (p, from, priorTo) {
          // if the last angle isn't filled in because we didn't have this point yet ...
          if (
            priorTo != null &&
            this.angles.length > 0 &&
            this.angles[this.angles.length - 1] == null
          ) {
            this.angles[this.angles.length - 1] = this.points[
              this.points.length - 1
            ].angleTo(priorTo);
          }
          this.addMarkerAngle(p, from == null ? null : from.angleTo(p));
        };

        this.addMarkerAngle = function (p, a) {
          this.points.push(p);
          this.angles.push(a);
        };

        this.getMarkerPoints = function () {
          return this.points;
        };
        this.getMarkerAngles = function () {
          for (var i = 0; i < this.angles.length; i++) {
            if (this.angles[i] == null) {
              for (var j = i + 1; j < this.angles.length; j++) {
                if (this.angles[j] != null) {
                  this.angles[i] = this.angles[j];
                  break;
                }
              }
            }
          }
          return this.angles;
        };
      })(d);

      this.path = function (ctx) {
        var pp = this.PathParser;
        pp.reset();

        var bb = new svg.BoundingBox();
        if (ctx != null) ctx.beginPath();
        while (!pp.isEnd()) {
          pp.nextCommand();
          switch (pp.command) {
            case "M":
            case "m":
              var p = pp.getAsCurrentPoint();
              pp.addMarker(p);
              bb.addPoint(p.x, p.y);
              if (ctx != null) ctx.moveTo(p.x, p.y);
              pp.start = pp.current;
              while (!pp.isCommandOrEnd()) {
                var p = pp.getAsCurrentPoint();
                pp.addMarker(p, pp.start);
                bb.addPoint(p.x, p.y);
                if (ctx != null) ctx.lineTo(p.x, p.y);
              }
              break;
            case "L":
            case "l":
              while (!pp.isCommandOrEnd()) {
                var c = pp.current;
                var p = pp.getAsCurrentPoint();
                pp.addMarker(p, c);
                bb.addPoint(p.x, p.y);
                if (ctx != null) ctx.lineTo(p.x, p.y);
              }
              break;
            case "H":
            case "h":
              while (!pp.isCommandOrEnd()) {
                var newP = new svg.Point(
                  (pp.isRelativeCommand() ? pp.current.x : 0) + pp.getScalar(),
                  pp.current.y
                );
                pp.addMarker(newP, pp.current);
                pp.current = newP;
                bb.addPoint(pp.current.x, pp.current.y);
                if (ctx != null) ctx.lineTo(pp.current.x, pp.current.y);
              }
              break;
            case "V":
            case "v":
              while (!pp.isCommandOrEnd()) {
                var newP = new svg.Point(
                  pp.current.x,
                  (pp.isRelativeCommand() ? pp.current.y : 0) + pp.getScalar()
                );
                pp.addMarker(newP, pp.current);
                pp.current = newP;
                bb.addPoint(pp.current.x, pp.current.y);
                if (ctx != null) ctx.lineTo(pp.current.x, pp.current.y);
              }
              break;
            case "C":
            case "c":
              while (!pp.isCommandOrEnd()) {
                var curr = pp.current;
                var p1 = pp.getPoint();
                var cntrl = pp.getAsControlPoint();
                var cp = pp.getAsCurrentPoint();
                pp.addMarker(cp, cntrl, p1);
                bb.addBezierCurve(
                  curr.x,
                  curr.y,
                  p1.x,
                  p1.y,
                  cntrl.x,
                  cntrl.y,
                  cp.x,
                  cp.y
                );
                if (ctx != null)
                  ctx.bezierCurveTo(p1.x, p1.y, cntrl.x, cntrl.y, cp.x, cp.y);
              }
              break;
            case "S":
            case "s":
              while (!pp.isCommandOrEnd()) {
                var curr = pp.current;
                var p1 = pp.getReflectedControlPoint();
                var cntrl = pp.getAsControlPoint();
                var cp = pp.getAsCurrentPoint();
                pp.addMarker(cp, cntrl, p1);
                bb.addBezierCurve(
                  curr.x,
                  curr.y,
                  p1.x,
                  p1.y,
                  cntrl.x,
                  cntrl.y,
                  cp.x,
                  cp.y
                );
                if (ctx != null)
                  ctx.bezierCurveTo(p1.x, p1.y, cntrl.x, cntrl.y, cp.x, cp.y);
              }
              break;
            case "Q":
            case "q":
              while (!pp.isCommandOrEnd()) {
                var curr = pp.current;
                var cntrl = pp.getAsControlPoint();
                var cp = pp.getAsCurrentPoint();
                pp.addMarker(cp, cntrl, cntrl);
                bb.addQuadraticCurve(
                  curr.x,
                  curr.y,
                  cntrl.x,
                  cntrl.y,
                  cp.x,
                  cp.y
                );
                if (ctx != null)
                  ctx.quadraticCurveTo(cntrl.x, cntrl.y, cp.x, cp.y);
              }
              break;
            case "T":
            case "t":
              while (!pp.isCommandOrEnd()) {
                var curr = pp.current;
                var cntrl = pp.getReflectedControlPoint();
                pp.control = cntrl;
                var cp = pp.getAsCurrentPoint();
                pp.addMarker(cp, cntrl, cntrl);
                bb.addQuadraticCurve(
                  curr.x,
                  curr.y,
                  cntrl.x,
                  cntrl.y,
                  cp.x,
                  cp.y
                );
                if (ctx != null)
                  ctx.quadraticCurveTo(cntrl.x, cntrl.y, cp.x, cp.y);
              }
              break;
            case "A":
            case "a":
              while (!pp.isCommandOrEnd()) {
                var curr = pp.current;
                var rx = pp.getScalar();
                var ry = pp.getScalar();
                var xAxisRotation = pp.getScalar() * (Math.PI / 180.0);
                var largeArcFlag = pp.getScalar();
                var sweepFlag = pp.getScalar();
                var cp = pp.getAsCurrentPoint();

                // Conversion from endpoint to center parameterization
                // http://www.w3.org/TR/SVG11/implnote.html#ArcImplementationNotes
                // x1', y1'
                var currp = new svg.Point(
                  (Math.cos(xAxisRotation) * (curr.x - cp.x)) / 2.0 +
                    (Math.sin(xAxisRotation) * (curr.y - cp.y)) / 2.0,
                  (-Math.sin(xAxisRotation) * (curr.x - cp.x)) / 2.0 +
                    (Math.cos(xAxisRotation) * (curr.y - cp.y)) / 2.0
                );
                // adjust radii
                var l =
                  Math.pow(currp.x, 2) / Math.pow(rx, 2) +
                  Math.pow(currp.y, 2) / Math.pow(ry, 2);
                if (l > 1) {
                  rx *= Math.sqrt(l);
                  ry *= Math.sqrt(l);
                }
                // cx', cy'
                var s =
                  (largeArcFlag == sweepFlag ? -1 : 1) *
                  Math.sqrt(
                    (Math.pow(rx, 2) * Math.pow(ry, 2) -
                      Math.pow(rx, 2) * Math.pow(currp.y, 2) -
                      Math.pow(ry, 2) * Math.pow(currp.x, 2)) /
                      (Math.pow(rx, 2) * Math.pow(currp.y, 2) +
                        Math.pow(ry, 2) * Math.pow(currp.x, 2))
                  );
                if (isNaN(s)) s = 0;
                var cpp = new svg.Point(
                  (s * rx * currp.y) / ry,
                  (s * -ry * currp.x) / rx
                );
                // cx, cy
                var centp = new svg.Point(
                  (curr.x + cp.x) / 2.0 +
                    Math.cos(xAxisRotation) * cpp.x -
                    Math.sin(xAxisRotation) * cpp.y,
                  (curr.y + cp.y) / 2.0 +
                    Math.sin(xAxisRotation) * cpp.x +
                    Math.cos(xAxisRotation) * cpp.y
                );
                // vector magnitude
                var m = function (v) {
                  return Math.sqrt(Math.pow(v[0], 2) + Math.pow(v[1], 2));
                };
                // ratio between two vectors
                var r = function (u, v) {
                  return (u[0] * v[0] + u[1] * v[1]) / (m(u) * m(v));
                };
                // angle between two vectors
                var a = function (u, v) {
                  return (
                    (u[0] * v[1] < u[1] * v[0] ? -1 : 1) * Math.acos(r(u, v))
                  );
                };
                // initial angle
                var a1 = a(
                  [1, 0],
                  [(currp.x - cpp.x) / rx, (currp.y - cpp.y) / ry]
                );
                // angle delta
                var u = [(currp.x - cpp.x) / rx, (currp.y - cpp.y) / ry];
                var v = [(-currp.x - cpp.x) / rx, (-currp.y - cpp.y) / ry];
                var ad = a(u, v);
                if (r(u, v) <= -1) ad = Math.PI;
                if (r(u, v) >= 1) ad = 0;

                // for markers
                var dir = 1 - sweepFlag ? 1.0 : -1.0;
                var ah = a1 + dir * (ad / 2.0);
                var halfWay = new svg.Point(
                  centp.x + rx * Math.cos(ah),
                  centp.y + ry * Math.sin(ah)
                );
                pp.addMarkerAngle(halfWay, ah - (dir * Math.PI) / 2);
                pp.addMarkerAngle(cp, ah - dir * Math.PI);

                bb.addPoint(cp.x, cp.y); // TODO: this is too naive, make it better
                if (ctx != null) {
                  var r = rx > ry ? rx : ry;
                  var sx = rx > ry ? 1 : rx / ry;
                  var sy = rx > ry ? ry / rx : 1;

                  ctx.translate(centp.x, centp.y);
                  ctx.rotate(xAxisRotation);
                  ctx.scale(sx, sy);
                  ctx.arc(0, 0, r, a1, a1 + ad, 1 - sweepFlag);
                  ctx.scale(1 / sx, 1 / sy);
                  ctx.rotate(-xAxisRotation);
                  ctx.translate(-centp.x, -centp.y);
                }
              }
              break;
            case "Z":
            case "z":
              if (ctx != null) ctx.closePath();
              pp.current = pp.start;
          }
        }

        return bb;
      };

      this.getMarkers = function () {
        var points = this.PathParser.getMarkerPoints();
        var angles = this.PathParser.getMarkerAngles();

        var markers = [];
        for (var i = 0; i < points.length; i++) {
          markers.push([points[i], angles[i]]);
        }
        return markers;
      };
    };
    svg.Element.path.prototype = new svg.Element.PathElementBase();

    // pattern element
    svg.Element.pattern = function (node) {
      this.base = svg.Element.ElementBase;
      this.base(node);

      this.createPattern = function (ctx, element) {
        var width = this.attribute("width").toPixels("x", true);
        var height = this.attribute("height").toPixels("y", true);

        // render me using a temporary svg element
        var tempSvg = new svg.Element.svg();
        tempSvg.attributes["viewBox"] = new svg.Property(
          "viewBox",
          this.attribute("viewBox").value
        );
        tempSvg.attributes["width"] = new svg.Property("width", width + "px");
        tempSvg.attributes["height"] = new svg.Property(
          "height",
          height + "px"
        );
        tempSvg.attributes["transform"] = new svg.Property(
          "transform",
          this.attribute("patternTransform").value
        );
        tempSvg.children = this.children;

        var c = document.createElement("canvas");
        c.width = width;
        c.height = height;
        var cctx = c.getContext("2d");
        if (this.attribute("x").hasValue() && this.attribute("y").hasValue()) {
          cctx.translate(
            this.attribute("x").toPixels("x", true),
            this.attribute("y").toPixels("y", true)
          );
        }
        // render 3x3 grid so when we transform there's no white space on edges
        for (var x = -1; x <= 1; x++) {
          for (var y = -1; y <= 1; y++) {
            cctx.save();
            cctx.translate(x * c.width, y * c.height);
            tempSvg.render(cctx);
            cctx.restore();
          }
        }
        var pattern = ctx.createPattern(c, "repeat");
        return pattern;
      };
    };
    svg.Element.pattern.prototype = new svg.Element.ElementBase();

    // marker element
    svg.Element.marker = function (node) {
      this.base = svg.Element.ElementBase;
      this.base(node);

      this.baseRender = this.render;
      this.render = function (ctx, point, angle) {
        ctx.translate(point.x, point.y);
        if (this.attribute("orient").valueOrDefault("auto") == "auto")
          ctx.rotate(angle);
        if (
          this.attribute("markerUnits").valueOrDefault("strokeWidth") ==
          "strokeWidth"
        )
          ctx.scale(ctx.lineWidth, ctx.lineWidth);
        ctx.save();

        // render me using a temporary svg element
        var tempSvg = new svg.Element.svg();
        tempSvg.attributes["viewBox"] = new svg.Property(
          "viewBox",
          this.attribute("viewBox").value
        );
        tempSvg.attributes["refX"] = new svg.Property(
          "refX",
          this.attribute("refX").value
        );
        tempSvg.attributes["refY"] = new svg.Property(
          "refY",
          this.attribute("refY").value
        );
        tempSvg.attributes["width"] = new svg.Property(
          "width",
          this.attribute("markerWidth").value
        );
        tempSvg.attributes["height"] = new svg.Property(
          "height",
          this.attribute("markerHeight").value
        );
        tempSvg.attributes["fill"] = new svg.Property(
          "fill",
          this.attribute("fill").valueOrDefault("black")
        );
        tempSvg.attributes["stroke"] = new svg.Property(
          "stroke",
          this.attribute("stroke").valueOrDefault("none")
        );
        tempSvg.children = this.children;
        tempSvg.render(ctx);

        ctx.restore();
        if (
          this.attribute("markerUnits").valueOrDefault("strokeWidth") ==
          "strokeWidth"
        )
          ctx.scale(1 / ctx.lineWidth, 1 / ctx.lineWidth);
        if (this.attribute("orient").valueOrDefault("auto") == "auto")
          ctx.rotate(-angle);
        ctx.translate(-point.x, -point.y);
      };
    };
    svg.Element.marker.prototype = new svg.Element.ElementBase();

    // definitions element
    svg.Element.defs = function (node) {
      this.base = svg.Element.ElementBase;
      this.base(node);

      this.render = function (ctx) {
        // NOOP
      };
    };
    svg.Element.defs.prototype = new svg.Element.ElementBase();

    // base for gradients
    svg.Element.GradientBase = function (node) {
      this.base = svg.Element.ElementBase;
      this.base(node);

      this.gradientUnits = this.attribute("gradientUnits").valueOrDefault(
        "objectBoundingBox"
      );

      this.stops = [];
      for (var i = 0; i < this.children.length; i++) {
        var child = this.children[i];
        if (child.type == "stop") this.stops.push(child);
      }

      this.getGradient = function () {
        // OVERRIDE ME!
      };

      this.createGradient = function (ctx, element, parentOpacityProp) {
        var stopsContainer = this;
        if (this.getHrefAttribute().hasValue()) {
          stopsContainer = this.getHrefAttribute().getDefinition();
        }

        var addParentOpacity = function (color) {
          if (parentOpacityProp.hasValue()) {
            var p = new svg.Property("color", color);
            return p.addOpacity(parentOpacityProp.value).value;
          }
          return color;
        };

        var g = this.getGradient(ctx, element);
        if (g == null)
          return addParentOpacity(
            stopsContainer.stops[stopsContainer.stops.length - 1].color
          );
        for (var i = 0; i < stopsContainer.stops.length; i++) {
          g.addColorStop(
            stopsContainer.stops[i].offset,
            addParentOpacity(stopsContainer.stops[i].color)
          );
        }

        if (this.attribute("gradientTransform").hasValue()) {
          // render as transformed pattern on temporary canvas
          var rootView = svg.ViewPort.viewPorts[0];

          var rect = new svg.Element.rect();
          rect.attributes["x"] = new svg.Property(
            "x",
            -svg.MAX_VIRTUAL_PIXELS / 3.0
          );
          rect.attributes["y"] = new svg.Property(
            "y",
            -svg.MAX_VIRTUAL_PIXELS / 3.0
          );
          rect.attributes["width"] = new svg.Property(
            "width",
            svg.MAX_VIRTUAL_PIXELS
          );
          rect.attributes["height"] = new svg.Property(
            "height",
            svg.MAX_VIRTUAL_PIXELS
          );

          var group = new svg.Element.g();
          group.attributes["transform"] = new svg.Property(
            "transform",
            this.attribute("gradientTransform").value
          );
          group.children = [rect];

          var tempSvg = new svg.Element.svg();
          tempSvg.attributes["x"] = new svg.Property("x", 0);
          tempSvg.attributes["y"] = new svg.Property("y", 0);
          tempSvg.attributes["width"] = new svg.Property(
            "width",
            rootView.width
          );
          tempSvg.attributes["height"] = new svg.Property(
            "height",
            rootView.height
          );
          tempSvg.children = [group];

          var c = document.createElement("canvas");
          c.width = rootView.width;
          c.height = rootView.height;
          var tempCtx = c.getContext("2d");
          tempCtx.fillStyle = g;
          tempSvg.render(tempCtx);
          return tempCtx.createPattern(c, "no-repeat");
        }

        return g;
      };
    };
    svg.Element.GradientBase.prototype = new svg.Element.ElementBase();

    // linear gradient element
    svg.Element.linearGradient = function (node) {
      this.base = svg.Element.GradientBase;
      this.base(node);

      this.getGradient = function (ctx, element) {
        var bb = element.getBoundingBox();

        if (
          !this.attribute("x1").hasValue() &&
          !this.attribute("y1").hasValue() &&
          !this.attribute("x2").hasValue() &&
          !this.attribute("y2").hasValue()
        ) {
          this.attribute("x1", true).value = 0;
          this.attribute("y1", true).value = 0;
          this.attribute("x2", true).value = 1;
          this.attribute("y2", true).value = 0;
        }

        var x1 =
          this.gradientUnits == "objectBoundingBox"
            ? bb.x() + bb.width() * this.attribute("x1").numValue()
            : this.attribute("x1").toPixels("x");
        var y1 =
          this.gradientUnits == "objectBoundingBox"
            ? bb.y() + bb.height() * this.attribute("y1").numValue()
            : this.attribute("y1").toPixels("y");
        var x2 =
          this.gradientUnits == "objectBoundingBox"
            ? bb.x() + bb.width() * this.attribute("x2").numValue()
            : this.attribute("x2").toPixels("x");
        var y2 =
          this.gradientUnits == "objectBoundingBox"
            ? bb.y() + bb.height() * this.attribute("y2").numValue()
            : this.attribute("y2").toPixels("y");

        if (x1 == x2 && y1 == y2) return null;
        return ctx.createLinearGradient(x1, y1, x2, y2);
      };
    };
    svg.Element.linearGradient.prototype = new svg.Element.GradientBase();

    // radial gradient element
    svg.Element.radialGradient = function (node) {
      this.base = svg.Element.GradientBase;
      this.base(node);

      this.getGradient = function (ctx, element) {
        var bb = element.getBoundingBox();

        if (!this.attribute("cx").hasValue())
          this.attribute("cx", true).value = "50%";
        if (!this.attribute("cy").hasValue())
          this.attribute("cy", true).value = "50%";
        if (!this.attribute("r").hasValue())
          this.attribute("r", true).value = "50%";

        var cx =
          this.gradientUnits == "objectBoundingBox"
            ? bb.x() + bb.width() * this.attribute("cx").numValue()
            : this.attribute("cx").toPixels("x");
        var cy =
          this.gradientUnits == "objectBoundingBox"
            ? bb.y() + bb.height() * this.attribute("cy").numValue()
            : this.attribute("cy").toPixels("y");

        var fx = cx;
        var fy = cy;
        if (this.attribute("fx").hasValue()) {
          fx =
            this.gradientUnits == "objectBoundingBox"
              ? bb.x() + bb.width() * this.attribute("fx").numValue()
              : this.attribute("fx").toPixels("x");
        }
        if (this.attribute("fy").hasValue()) {
          fy =
            this.gradientUnits == "objectBoundingBox"
              ? bb.y() + bb.height() * this.attribute("fy").numValue()
              : this.attribute("fy").toPixels("y");
        }

        var r =
          this.gradientUnits == "objectBoundingBox"
            ? ((bb.width() + bb.height()) / 2.0) *
              this.attribute("r").numValue()
            : this.attribute("r").toPixels();

        return ctx.createRadialGradient(fx, fy, 0, cx, cy, r);
      };
    };
    svg.Element.radialGradient.prototype = new svg.Element.GradientBase();

    // gradient stop element
    svg.Element.stop = function (node) {
      this.base = svg.Element.ElementBase;
      this.base(node);

      this.offset = this.attribute("offset").numValue();
      if (this.offset < 0) this.offset = 0;
      if (this.offset > 1) this.offset = 1;

      var stopColor = this.style("stop-color");
      if (this.style("stop-opacity").hasValue())
        stopColor = stopColor.addOpacity(this.style("stop-opacity").value);
      this.color = stopColor.value;
    };
    svg.Element.stop.prototype = new svg.Element.ElementBase();

    // animation base element
    svg.Element.AnimateBase = function (node) {
      this.base = svg.Element.ElementBase;
      this.base(node);

      svg.Animations.push(this);

      this.duration = 0.0;
      this.begin = this.attribute("begin").toMilliseconds();
      this.maxDuration = this.begin + this.attribute("dur").toMilliseconds();

      this.getProperty = function () {
        var attributeType = this.attribute("attributeType").value;
        var attributeName = this.attribute("attributeName").value;

        if (attributeType == "CSS") {
          return this.parent.style(attributeName, true);
        }
        return this.parent.attribute(attributeName, true);
      };

      this.initialValue = null;
      this.initialUnits = "";
      this.removed = false;

      this.calcValue = function () {
        // OVERRIDE ME!
        return "";
      };

      this.update = function (delta) {
        // set initial value
        if (this.initialValue == null) {
          this.initialValue = this.getProperty().value;
          this.initialUnits = this.getProperty().getUnits();
        }

        // if we're past the end time
        if (this.duration > this.maxDuration) {
          // loop for indefinitely repeating animations
          if (
            this.attribute("repeatCount").value == "indefinite" ||
            this.attribute("repeatDur").value == "indefinite"
          ) {
            this.duration = 0.0;
          } else if (
            this.attribute("fill").valueOrDefault("remove") == "remove" &&
            !this.removed
          ) {
            this.removed = true;
            this.getProperty().value = this.initialValue;
            return true;
          } else {
            return false; // no updates made
          }
        }
        this.duration = this.duration + delta;

        // if we're past the begin time
        var updated = false;
        if (this.begin < this.duration) {
          var newValue = this.calcValue(); // tween

          if (this.attribute("type").hasValue()) {
            // for transform, etc.
            var type = this.attribute("type").value;
            newValue = type + "(" + newValue + ")";
          }

          this.getProperty().value = newValue;
          updated = true;
        }

        return updated;
      };

      this.from = this.attribute("from");
      this.to = this.attribute("to");
      this.values = this.attribute("values");
      if (this.values.hasValue())
        this.values.value = this.values.value.split(";");

      // fraction of duration we've covered
      this.progress = function () {
        var ret = {
          progress:
            (this.duration - this.begin) / (this.maxDuration - this.begin),
        };
        if (this.values.hasValue()) {
          var p = ret.progress * (this.values.value.length - 1);
          var lb = Math.floor(p),
            ub = Math.ceil(p);
          ret.from = new svg.Property(
            "from",
            parseFloat(this.values.value[lb])
          );
          ret.to = new svg.Property("to", parseFloat(this.values.value[ub]));
          ret.progress = (p - lb) / (ub - lb);
        } else {
          ret.from = this.from;
          ret.to = this.to;
        }
        return ret;
      };
    };
    svg.Element.AnimateBase.prototype = new svg.Element.ElementBase();

    // animate element
    svg.Element.animate = function (node) {
      this.base = svg.Element.AnimateBase;
      this.base(node);

      this.calcValue = function () {
        var p = this.progress();

        // tween value linearly
        var newValue =
          p.from.numValue() +
          (p.to.numValue() - p.from.numValue()) * p.progress;
        return newValue + this.initialUnits;
      };
    };
    svg.Element.animate.prototype = new svg.Element.AnimateBase();

    // animate color element
    svg.Element.animateColor = function (node) {
      this.base = svg.Element.AnimateBase;
      this.base(node);

      this.calcValue = function () {
        var p = this.progress();
        var from = new RGBColor(p.from.value);
        var to = new RGBColor(p.to.value);

        if (from.ok && to.ok) {
          // tween color linearly
          var r = from.r + (to.r - from.r) * p.progress;
          var g = from.g + (to.g - from.g) * p.progress;
          var b = from.b + (to.b - from.b) * p.progress;
          return (
            "rgb(" +
            parseInt(r, 10) +
            "," +
            parseInt(g, 10) +
            "," +
            parseInt(b, 10) +
            ")"
          );
        }
        return this.attribute("from").value;
      };
    };
    svg.Element.animateColor.prototype = new svg.Element.AnimateBase();

    // animate transform element
    svg.Element.animateTransform = function (node) {
      this.base = svg.Element.AnimateBase;
      this.base(node);

      this.calcValue = function () {
        var p = this.progress();

        // tween value linearly
        var from = svg.ToNumberArray(p.from.value);
        var to = svg.ToNumberArray(p.to.value);
        var newValue = "";
        for (var i = 0; i < from.length; i++) {
          newValue += from[i] + (to[i] - from[i]) * p.progress + " ";
        }
        return newValue;
      };
    };
    svg.Element.animateTransform.prototype = new svg.Element.animate();

    // font element
    svg.Element.font = function (node) {
      this.base = svg.Element.ElementBase;
      this.base(node);

      this.horizAdvX = this.attribute("horiz-adv-x").numValue();

      this.isRTL = false;
      this.isArabic = false;
      this.fontFace = null;
      this.missingGlyph = null;
      this.glyphs = [];
      for (var i = 0; i < this.children.length; i++) {
        var child = this.children[i];
        if (child.type == "font-face") {
          this.fontFace = child;
          if (child.style("font-family").hasValue()) {
            svg.Definitions[child.style("font-family").value] = this;
          }
        } else if (child.type == "missing-glyph") this.missingGlyph = child;
        else if (child.type == "glyph") {
          if (child.arabicForm != "") {
            this.isRTL = true;
            this.isArabic = true;
            if (typeof this.glyphs[child.unicode] == "undefined")
              this.glyphs[child.unicode] = [];
            this.glyphs[child.unicode][child.arabicForm] = child;
          } else {
            this.glyphs[child.unicode] = child;
          }
        }
      }
    };
    svg.Element.font.prototype = new svg.Element.ElementBase();

    // font-face element
    svg.Element.fontface = function (node) {
      this.base = svg.Element.ElementBase;
      this.base(node);

      this.ascent = this.attribute("ascent").value;
      this.descent = this.attribute("descent").value;
      this.unitsPerEm = this.attribute("units-per-em").numValue();
    };
    svg.Element.fontface.prototype = new svg.Element.ElementBase();

    // missing-glyph element
    svg.Element.missingglyph = function (node) {
      this.base = svg.Element.path;
      this.base(node);

      this.horizAdvX = 0;
    };
    svg.Element.missingglyph.prototype = new svg.Element.path();

    // glyph element
    svg.Element.glyph = function (node) {
      this.base = svg.Element.path;
      this.base(node);

      this.horizAdvX = this.attribute("horiz-adv-x").numValue();
      this.unicode = this.attribute("unicode").value;
      this.arabicForm = this.attribute("arabic-form").value;
    };
    svg.Element.glyph.prototype = new svg.Element.path();

    // text element
    svg.Element.text = function (node) {
      this.captureTextNodes = true;
      this.base = svg.Element.RenderedElementBase;
      this.base(node);

      this.baseSetContext = this.setContext;
      this.setContext = function (ctx) {
        this.baseSetContext(ctx);
        if (this.style("dominant-baseline").hasValue())
          ctx.textBaseline = this.style("dominant-baseline").value;
        if (this.style("alignment-baseline").hasValue())
          ctx.textBaseline = this.style("alignment-baseline").value;
      };

      this.getBoundingBox = function () {
        // TODO: implement
        return new svg.BoundingBox(
          this.attribute("x").toPixels("x"),
          this.attribute("y").toPixels("y"),
          0,
          0
        );
      };

      this.renderChildren = function (ctx) {
        this.x = this.attribute("x").toPixels("x");
        this.y = this.attribute("y").toPixels("y");
        this.x += this.getAnchorDelta(ctx, this, 0);
        for (var i = 0; i < this.children.length; i++) {
          this.renderChild(ctx, this, i);
        }
      };

      this.getAnchorDelta = function (ctx, parent, startI) {
        var textAnchor = this.style("text-anchor").valueOrDefault("start");
        if (textAnchor != "start") {
          var width = 0;
          for (var i = startI; i < parent.children.length; i++) {
            var child = parent.children[i];
            if (i > startI && child.attribute("x").hasValue()) break; // new group
            width += child.measureTextRecursive(ctx);
          }
          return -1 * (textAnchor == "end" ? width : width / 2.0);
        }
        return 0;
      };

      this.renderChild = function (ctx, parent, i) {
        var child = parent.children[i];
        if (child.attribute("x").hasValue()) {
          child.x =
            child.attribute("x").toPixels("x") +
            this.getAnchorDelta(ctx, parent, i);
        } else {
          if (this.attribute("dx").hasValue())
            this.x += this.attribute("dx").toPixels("x");
          if (child.attribute("dx").hasValue())
            this.x += child.attribute("dx").toPixels("x");
          child.x = this.x;
        }
        this.x = child.x + child.measureText(ctx);

        if (child.attribute("y").hasValue()) {
          child.y = child.attribute("y").toPixels("y");
        } else {
          if (this.attribute("dy").hasValue())
            this.y += this.attribute("dy").toPixels("y");
          if (child.attribute("dy").hasValue())
            this.y += child.attribute("dy").toPixels("y");
          child.y = this.y;
        }
        this.y = child.y;

        child.render(ctx);

        for (var i = 0; i < child.children.length; i++) {
          this.renderChild(ctx, child, i);
        }
      };
    };
    svg.Element.text.prototype = new svg.Element.RenderedElementBase();

    // text base
    svg.Element.TextElementBase = function (node) {
      this.base = svg.Element.RenderedElementBase;
      this.base(node);

      this.getGlyph = function (font, text, i) {
        var c = text[i];
        var glyph = null;
        if (font.isArabic) {
          var arabicForm = "isolated";
          if (
            (i == 0 || text[i - 1] == " ") &&
            i < text.length - 2 &&
            text[i + 1] != " "
          )
            arabicForm = "terminal";
          if (
            i > 0 &&
            text[i - 1] != " " &&
            i < text.length - 2 &&
            text[i + 1] != " "
          )
            arabicForm = "medial";
          if (
            i > 0 &&
            text[i - 1] != " " &&
            (i == text.length - 1 || text[i + 1] == " ")
          )
            arabicForm = "initial";
          if (typeof font.glyphs[c] != "undefined") {
            glyph = font.glyphs[c][arabicForm];
            if (glyph == null && font.glyphs[c].type == "glyph")
              glyph = font.glyphs[c];
          }
        } else {
          glyph = font.glyphs[c];
        }
        if (glyph == null) glyph = font.missingGlyph;
        return glyph;
      };

      this.renderChildren = function (ctx) {
        var customFont = this.parent.style("font-family").getDefinition();
        if (customFont != null) {
          var fontSize = this.parent
            .style("font-size")
            .numValueOrDefault(svg.Font.Parse(svg.ctx.font).fontSize);
          var fontStyle = this.parent
            .style("font-style")
            .valueOrDefault(svg.Font.Parse(svg.ctx.font).fontStyle);
          var text = this.getText();
          if (customFont.isRTL) text = text.split("").reverse().join("");

          var dx = svg.ToNumberArray(this.parent.attribute("dx").value);
          for (var i = 0; i < text.length; i++) {
            var glyph = this.getGlyph(customFont, text, i);
            var scale = fontSize / customFont.fontFace.unitsPerEm;
            ctx.translate(this.x, this.y);
            ctx.scale(scale, -scale);
            var lw = ctx.lineWidth;
            ctx.lineWidth =
              (ctx.lineWidth * customFont.fontFace.unitsPerEm) / fontSize;
            if (fontStyle == "italic") ctx.transform(1, 0, 0.4, 1, 0, 0);
            glyph.render(ctx);
            if (fontStyle == "italic") ctx.transform(1, 0, -0.4, 1, 0, 0);
            ctx.lineWidth = lw;
            ctx.scale(1 / scale, -1 / scale);
            ctx.translate(-this.x, -this.y);

            this.x +=
              (fontSize * (glyph.horizAdvX || customFont.horizAdvX)) /
              customFont.fontFace.unitsPerEm;
            if (typeof dx[i] != "undefined" && !isNaN(dx[i])) {
              this.x += dx[i];
            }
          }
          return;
        }

        if (ctx.fillStyle != "")
          ctx.fillText(svg.compressSpaces(this.getText()), this.x, this.y);
        if (ctx.strokeStyle != "")
          ctx.strokeText(svg.compressSpaces(this.getText()), this.x, this.y);
      };

      this.getText = function () {
        // OVERRIDE ME
      };

      this.measureTextRecursive = function (ctx) {
        var width = this.measureText(ctx);
        for (var i = 0; i < this.children.length; i++) {
          width += this.children[i].measureTextRecursive(ctx);
        }
        return width;
      };

      this.measureText = function (ctx) {
        var customFont = this.parent.style("font-family").getDefinition();
        if (customFont != null) {
          var fontSize = this.parent
            .style("font-size")
            .numValueOrDefault(svg.Font.Parse(svg.ctx.font).fontSize);
          var measure = 0;
          var text = this.getText();
          if (customFont.isRTL) text = text.split("").reverse().join("");
          var dx = svg.ToNumberArray(this.parent.attribute("dx").value);
          for (var i = 0; i < text.length; i++) {
            var glyph = this.getGlyph(customFont, text, i);
            measure +=
              ((glyph.horizAdvX || customFont.horizAdvX) * fontSize) /
              customFont.fontFace.unitsPerEm;
            if (typeof dx[i] != "undefined" && !isNaN(dx[i])) {
              measure += dx[i];
            }
          }
          return measure;
        }

        var textToMeasure = svg.compressSpaces(this.getText());
        if (!ctx.measureText) return textToMeasure.length * 10;

        ctx.save();
        this.setContext(ctx);
        var width = ctx.measureText(textToMeasure).width;
        ctx.restore();
        return width;
      };
    };
    svg.Element.TextElementBase.prototype = new svg.Element.RenderedElementBase();

    // tspan
    svg.Element.tspan = function (node) {
      this.captureTextNodes = true;
      this.base = svg.Element.TextElementBase;
      this.base(node);

      this.text = node.nodeValue || node.text || "";
      this.getText = function () {
        return this.text;
      };
    };
    svg.Element.tspan.prototype = new svg.Element.TextElementBase();

    // tref
    svg.Element.tref = function (node) {
      this.base = svg.Element.TextElementBase;
      this.base(node);

      this.getText = function () {
        var element = this.getHrefAttribute().getDefinition();
        if (element != null) return element.children[0].getText();
      };
    };
    svg.Element.tref.prototype = new svg.Element.TextElementBase();

    // a element
    svg.Element.a = function (node) {
      this.base = svg.Element.TextElementBase;
      this.base(node);

      this.hasText = true;
      for (var i = 0; i < node.childNodes.length; i++) {
        if (node.childNodes[i].nodeType != 3) this.hasText = false;
      }

      // this might contain text
      this.text = this.hasText ? node.childNodes[0].nodeValue : "";
      this.getText = function () {
        return this.text;
      };

      this.baseRenderChildren = this.renderChildren;
      this.renderChildren = function (ctx) {
        if (this.hasText) {
          // render as text element
          this.baseRenderChildren(ctx);
          var fontSize = new svg.Property(
            "fontSize",
            svg.Font.Parse(svg.ctx.font).fontSize
          );
          svg.Mouse.checkBoundingBox(
            this,
            new svg.BoundingBox(
              this.x,
              this.y - fontSize.toPixels("y"),
              this.x + this.measureText(ctx),
              this.y
            )
          );
        } else {
          // render as temporary group
          var g = new svg.Element.g();
          g.children = this.children;
          g.parent = this;
          g.render(ctx);
        }
      };

      this.onclick = function () {
        window.open(this.getHrefAttribute().value);
      };

      this.onmousemove = function () {
        svg.ctx.canvas.style.cursor = "pointer";
      };
    };
    svg.Element.a.prototype = new svg.Element.TextElementBase();

    // image element
    svg.Element.image = function (node) {
      this.base = svg.Element.RenderedElementBase;
      this.base(node);

      var href = this.getHrefAttribute().value;
      var isSvg = href.match(/\.svg$/);
      console.log("isSvg" + isSvg);
      svg.Images.push(this);
      this.loaded = false;
      if (!isSvg) {
        this.img = document.createElement("img");
        var self = this;
        this.img.onload = function () {
          self.loaded = true;
        };
        this.img.onerror = function () {
          if (typeof console != "undefined") {
            console.log('ERROR: image "' + href + '" not found');
            self.loaded = true;
          }
        };
        this.img.src = href;
      } else {
        this.img = svg.ajax(href);
        this.loaded = true;
      }

      this.renderChildren = function (ctx) {
        var x = this.attribute("x").toPixels("x");
        var y = this.attribute("y").toPixels("y");

        var width = this.attribute("width").toPixels("x");
        var height = this.attribute("height").toPixels("y");
        if (width == 0 || height == 0) return;

        ctx.save();
        if (isSvg) {
          ctx.drawSvg(this.img, x, y, width, height);
        } else {
          ctx.translate(x, y);
          svg.AspectRatio(
            ctx,
            this.attribute("preserveAspectRatio").value,
            width,
            this.img.width,
            height,
            this.img.height,
            0,
            0
          );
          ctx.drawImage(this.img, 0, 0);
        }
        ctx.restore();
      };

      this.getBoundingBox = function () {
        var x = this.attribute("x").toPixels("x");
        var y = this.attribute("y").toPixels("y");
        var width = this.attribute("width").toPixels("x");
        var height = this.attribute("height").toPixels("y");
        return new svg.BoundingBox(x, y, x + width, y + height);
      };
    };
    svg.Element.image.prototype = new svg.Element.RenderedElementBase();

    // group element
    svg.Element.g = function (node) {
      this.base = svg.Element.RenderedElementBase;
      this.base(node);

      this.getBoundingBox = function () {
        var bb = new svg.BoundingBox();
        console.log("this.children.length " + this.children.length);
        for (var i = 0; i < this.children.length; i++) {
          bb.addBoundingBox(this.children[i].getBoundingBox());
        }
        return bb;
      };
    };
    svg.Element.g.prototype = new svg.Element.RenderedElementBase();

    // symbol element
    svg.Element.symbol = function (node) {
      this.base = svg.Element.RenderedElementBase;
      this.base(node);

      this.baseSetContext = this.setContext;
      this.setContext = function (ctx) {
        this.baseSetContext(ctx);

        // viewbox
        if (this.attribute("viewBox").hasValue()) {
          var viewBox = svg.ToNumberArray(this.attribute("viewBox").value);
          var minX = viewBox[0];
          var minY = viewBox[1];
          width = viewBox[2];
          height = viewBox[3];

          svg.AspectRatio(
            ctx,
            this.attribute("preserveAspectRatio").value,
            this.attribute("width").toPixels("x"),
            width,
            this.attribute("height").toPixels("y"),
            height,
            minX,
            minY
          );

          svg.ViewPort.SetCurrent(viewBox[2], viewBox[3]);
        }
      };
    };
    svg.Element.symbol.prototype = new svg.Element.RenderedElementBase();

    // style element
    svg.Element.style = function (node) {
      this.base = svg.Element.ElementBase;
      this.base(node);

      // text, or spaces then CDATA
      var css = "";
      for (var i = 0; i < node.childNodes.length; i++) {
        css += node.childNodes[i].nodeValue;
      }
      css = css.replace(
        /(\/\*([^*]|[\r\n]|(\*+([^*\/]|[\r\n])))*\*+\/)|(^[\s]*\/\/.*)/gm,
        ""
      ); // remove comments
      css = svg.compressSpaces(css); // replace whitespace
      var cssDefs = css.split("}");
      for (var i = 0; i < cssDefs.length; i++) {
        if (svg.trim(cssDefs[i]) != "") {
          var cssDef = cssDefs[i].split("{");
          var cssClasses = cssDef[0].split(",");
          var cssProps = cssDef[1].split(";");
          for (var j = 0; j < cssClasses.length; j++) {
            var cssClass = svg.trim(cssClasses[j]);
            if (cssClass != "") {
              var props = {};
              for (var k = 0; k < cssProps.length; k++) {
                var prop = cssProps[k].indexOf(":");
                var name = cssProps[k].substr(0, prop);
                var value = cssProps[k].substr(
                  prop + 1,
                  cssProps[k].length - prop
                );
                if (name != null && value != null) {
                  props[svg.trim(name)] = new svg.Property(
                    svg.trim(name),
                    svg.trim(value)
                  );
                }
              }
              svg.Styles[cssClass] = props;
              if (cssClass == "@font-face") {
                var fontFamily = props["font-family"].value.replace(/"/g, "");
                var srcs = props["src"].value.split(",");
                for (var s = 0; s < srcs.length; s++) {
                  if (srcs[s].indexOf('format("svg")') > 0) {
                    var urlStart = srcs[s].indexOf("url");
                    var urlEnd = srcs[s].indexOf(")", urlStart);
                    var url = srcs[s].substr(
                      urlStart + 5,
                      urlEnd - urlStart - 6
                    );
                    var doc = svg.parseXml(svg.ajax(url));
                    var fonts = doc.getElementsByTagName("font");
                    for (var f = 0; f < fonts.length; f++) {
                      var font = svg.CreateElement(fonts[f]);
                      svg.Definitions[fontFamily] = font;
                    }
                  }
                }
              }
            }
          }
        }
      }
    };
    svg.Element.style.prototype = new svg.Element.ElementBase();

    // use element
    svg.Element.use = function (node) {
      this.base = svg.Element.RenderedElementBase;
      this.base(node);

      this.baseSetContext = this.setContext;
      this.setContext = function (ctx) {
        this.baseSetContext(ctx);
        if (this.attribute("x").hasValue())
          ctx.translate(this.attribute("x").toPixels("x"), 0);
        if (this.attribute("y").hasValue())
          ctx.translate(0, this.attribute("y").toPixels("y"));
      };

      this.getDefinition = function () {
        var element = this.getHrefAttribute().getDefinition();
        if (this.attribute("width").hasValue())
          element.attribute("width", true).value = this.attribute(
            "width"
          ).value;
        if (this.attribute("height").hasValue())
          element.attribute("height", true).value = this.attribute(
            "height"
          ).value;
        return element;
      };

      this.path = function (ctx) {
        var element = this.getDefinition();
        if (element != null) element.path(ctx);
      };

      this.getBoundingBox = function () {
        var element = this.getDefinition();
        if (element != null) return element.getBoundingBox();
      };

      this.renderChildren = function (ctx) {
        var element = this.getDefinition();
        if (element != null) {
          // temporarily detach from parent and render
          var oldParent = element.parent;
          element.parent = null;
          element.render(ctx);
          element.parent = oldParent;
        }
      };
    };
    svg.Element.use.prototype = new svg.Element.RenderedElementBase();

    // mask element
    svg.Element.mask = function (node) {
      this.base = svg.Element.ElementBase;
      this.base(node);

      this.apply = function (ctx, element) {
        // render as temp svg
        var x = this.attribute("x").toPixels("x");
        var y = this.attribute("y").toPixels("y");
        var width = this.attribute("width").toPixels("x");
        var height = this.attribute("height").toPixels("y");

        if (width == 0 && height == 0) {
          var bb = new svg.BoundingBox();
          for (var i = 0; i < this.children.length; i++) {
            bb.addBoundingBox(this.children[i].getBoundingBox());
          }
          var x = Math.floor(bb.x1);
          var y = Math.floor(bb.y1);
          var width = Math.floor(bb.width());
          var height = Math.floor(bb.height());
        }

        // temporarily remove mask to avoid recursion
        var mask = element.attribute("mask").value;
        element.attribute("mask").value = "";

        var cMask = document.createElement("canvas");
        cMask.width = x + width;
        cMask.height = y + height;
        var maskCtx = cMask.getContext("2d");
        this.renderChildren(maskCtx);

        var c = document.createElement("canvas");
        c.width = x + width;
        c.height = y + height;
        var tempCtx = c.getContext("2d");
        element.render(tempCtx);
        tempCtx.globalCompositeOperation = "destination-in";
        tempCtx.fillStyle = maskCtx.createPattern(cMask, "no-repeat");
        tempCtx.fillRect(0, 0, x + width, y + height);

        ctx.fillStyle = tempCtx.createPattern(c, "no-repeat");
        ctx.fillRect(0, 0, x + width, y + height);

        // reassign mask
        element.attribute("mask").value = mask;
      };

      this.render = function (ctx) {
        // NO RENDER
      };
    };
    svg.Element.mask.prototype = new svg.Element.ElementBase();

    // clip element
    svg.Element.clipPath = function (node) {
      this.base = svg.Element.ElementBase;
      this.base(node);

      this.apply = function (ctx) {
        for (var i = 0; i < this.children.length; i++) {
          var child = this.children[i];
          if (typeof child.path != "undefined") {
            var transform = null;
            if (child.attribute("transform").hasValue()) {
              transform = new svg.Transform(child.attribute("transform").value);
              transform.apply(ctx);
            }
            child.path(ctx);
            ctx.clip();
            if (transform) {
              transform.unapply(ctx);
            }
          }
        }
      };

      this.render = function (ctx) {
        // NO RENDER
      };
    };
    svg.Element.clipPath.prototype = new svg.Element.ElementBase();

    // filters
    svg.Element.filter = function (node) {
      this.base = svg.Element.ElementBase;
      this.base(node);

      this.apply = function (ctx, element) {
        // render as temp svg
        var bb = element.getBoundingBox();
        var x = Math.floor(bb.x1);
        var y = Math.floor(bb.y1);
        var width = Math.floor(bb.width());
        var height = Math.floor(bb.height());

        // temporarily remove filter to avoid recursion
        var filter = element.style("filter").value;
        element.style("filter").value = "";

        var px = 0,
          py = 0;
        for (var i = 0; i < this.children.length; i++) {
          var efd = this.children[i].extraFilterDistance || 0;
          px = Math.max(px, efd);
          py = Math.max(py, efd);
        }

        var c = document.createElement("canvas");
        c.width = width + 2 * px;
        c.height = height + 2 * py;
        var tempCtx = c.getContext("2d");
        tempCtx.translate(-x + px, -y + py);
        element.render(tempCtx);

        // apply filters
        for (var i = 0; i < this.children.length; i++) {
          this.children[i].apply(
            tempCtx,
            0,
            0,
            width + 2 * px,
            height + 2 * py
          );
        }

        // render on me
        ctx.drawImage(
          c,
          0,
          0,
          width + 2 * px,
          height + 2 * py,
          x - px,
          y - py,
          width + 2 * px,
          height + 2 * py
        );

        // reassign filter
        element.style("filter", true).value = filter;
      };

      this.render = function (ctx) {
        // NO RENDER
      };
    };
    svg.Element.filter.prototype = new svg.Element.ElementBase();

    svg.Element.feMorphology = function (node) {
      this.base = svg.Element.ElementBase;
      this.base(node);

      this.apply = function (ctx, x, y, width, height) {
        // TODO: implement
      };
    };
    svg.Element.feMorphology.prototype = new svg.Element.ElementBase();

    svg.Element.feColorMatrix = function (node) {
      this.base = svg.Element.ElementBase;
      this.base(node);

      function imGet(img, x, y, width, height, rgba) {
        return img[y * width * 4 + x * 4 + rgba];
      }

      function imSet(img, x, y, width, height, rgba, val) {
        img[y * width * 4 + x * 4 + rgba] = val;
      }

      this.apply = function (ctx, x, y, width, height) {
        // only supporting grayscale for now per Issue 195, need to extend to all matrix
        // assuming x==0 && y==0 for now
        var srcData = ctx.getImageData(0, 0, width, height);
        for (var y = 0; y < height; y++) {
          for (var x = 0; x < width; x++) {
            var r = imGet(srcData.data, x, y, width, height, 0);
            var g = imGet(srcData.data, x, y, width, height, 1);
            var b = imGet(srcData.data, x, y, width, height, 2);
            var gray = (r + g + b) / 3;
            imSet(srcData.data, x, y, width, height, 0, gray);
            imSet(srcData.data, x, y, width, height, 1, gray);
            imSet(srcData.data, x, y, width, height, 2, gray);
          }
        }
        ctx.clearRect(0, 0, width, height);
        ctx.putImageData(srcData, 0, 0);
      };
    };
    svg.Element.feColorMatrix.prototype = new svg.Element.ElementBase();

    svg.Element.feGaussianBlur = function (node) {
      this.base = svg.Element.ElementBase;
      this.base(node);

      this.blurRadius = Math.floor(this.attribute("stdDeviation").numValue());
      this.extraFilterDistance = this.blurRadius;

      this.apply = function (ctx, x, y, width, height) {
        if (typeof stackBlurCanvasRGBA == "undefined") {
          if (typeof console != "undefined") {
            console.log(
              "ERROR: StackBlur.js must be included for blur to work"
            );
          }
          return;
        }

        // StackBlur requires canvas be on document
        ctx.canvas.id = svg.UniqueId();
        ctx.canvas.style.display = "none";
        document.body.appendChild(ctx.canvas);
        stackBlurCanvasRGBA(
          ctx.canvas.id,
          x,
          y,
          width,
          height,
          this.blurRadius
        );
        document.body.removeChild(ctx.canvas);
      };
    };
    svg.Element.feGaussianBlur.prototype = new svg.Element.ElementBase();

    // title element, do nothing
    svg.Element.title = function (node) {};
    svg.Element.title.prototype = new svg.Element.ElementBase();

    // desc element, do nothing
    svg.Element.desc = function (node) {};
    svg.Element.desc.prototype = new svg.Element.ElementBase();

    svg.Element.MISSING = function (node) {
      if (typeof console != "undefined") {
        console.log(
          "ERROR: Element '" + node.nodeName + "' not yet implemented."
        );
      }
    };
    svg.Element.MISSING.prototype = new svg.Element.ElementBase();

    // element factory
    svg.CreateElement = function (node) {
      var className = node.nodeName.replace(/^[^:]+:/, ""); // remove namespace
      className = className.replace(/\-/g, ""); // remove dashes
      var e = null;
      if (typeof svg.Element[className] != "undefined") {
        e = new svg.Element[className](node);
      } else {
        e = new svg.Element.MISSING(node);
      }

      e.type = node.nodeName;
      return e;
    };

    // load from url
    svg.load = function (ctx, url) {
      svg.loadXml(ctx, svg.ajax(url));
    };

    // load from xml
    svg.loadXml = function (ctx, xml) {
      svg.loadXmlDoc(ctx, svg.parseXml(xml));
    };

    svg.loadXmlDoc = function (ctx, dom) {
      svg.init(ctx);

      var mapXY = function (p) {
        var e = ctx.canvas;
        while (e) {
          p.x -= e.offsetLeft;
          p.y -= e.offsetTop;
          e = e.offsetParent;
        }
        if (window.scrollX) p.x += window.scrollX;
        if (window.scrollY) p.y += window.scrollY;
        return p;
      };

      // bind mouse
      if (svg.opts["ignoreMouse"] != true) {
        ctx.canvas.onclick = function (e) {
          var p = mapXY(
            new svg.Point(
              e != null ? e.clientX : event.clientX,
              e != null ? e.clientY : event.clientY
            )
          );
          svg.Mouse.onclick(p.x, p.y);
        };
        ctx.canvas.onmousemove = function (e) {
          var p = mapXY(
            new svg.Point(
              e != null ? e.clientX : event.clientX,
              e != null ? e.clientY : event.clientY
            )
          );
          svg.Mouse.onmousemove(p.x, p.y);
        };
      }

      var e = svg.CreateElement(dom.documentElement);
      e.root = true;

      // render loop
      var isFirstRender = true;
      var draw = function () {
        svg.ViewPort.Clear();
        if (ctx.canvas.parentNode)
          svg.ViewPort.SetCurrent(
            ctx.canvas.parentNode.clientWidth,
            ctx.canvas.parentNode.clientHeight
          );

        if (svg.opts["ignoreDimensions"] != true) {
          // set canvas size
          if (e.style("width").hasValue()) {
            ctx.canvas.width = e.style("width").toPixels("x");
            ctx.canvas.style.width = ctx.canvas.width + "px";
          }
          if (e.style("height").hasValue()) {
            ctx.canvas.height = e.style("height").toPixels("y");
            ctx.canvas.style.height = ctx.canvas.height + "px";
          }
        }
        var cWidth = ctx.canvas.clientWidth || ctx.canvas.width;
        var cHeight = ctx.canvas.clientHeight || ctx.canvas.height;
        if (
          svg.opts["ignoreDimensions"] == true &&
          e.style("width").hasValue() &&
          e.style("height").hasValue()
        ) {
          cWidth = e.style("width").toPixels("x");
          cHeight = e.style("height").toPixels("y");
        }
        svg.ViewPort.SetCurrent(cWidth, cHeight);

        if (svg.opts["offsetX"] != null)
          e.attribute("x", true).value = svg.opts["offsetX"];
        if (svg.opts["offsetY"] != null)
          e.attribute("y", true).value = svg.opts["offsetY"];
        if (svg.opts["scaleWidth"] != null && svg.opts["scaleHeight"] != null) {
          var xRatio = 1,
            yRatio = 1,
            viewBox = svg.ToNumberArray(e.attribute("viewBox").value);
          if (e.attribute("width").hasValue())
            xRatio =
              e.attribute("width").toPixels("x") / svg.opts["scaleWidth"];
          else if (!isNaN(viewBox[2]))
            xRatio = viewBox[2] / svg.opts["scaleWidth"];
          if (e.attribute("height").hasValue())
            yRatio =
              e.attribute("height").toPixels("y") / svg.opts["scaleHeight"];
          else if (!isNaN(viewBox[3]))
            yRatio = viewBox[3] / svg.opts["scaleHeight"];

          e.attribute("width", true).value = svg.opts["scaleWidth"];
          e.attribute("height", true).value = svg.opts["scaleHeight"];
          e.attribute("viewBox", true).value =
            "0 0 " + cWidth * xRatio + " " + cHeight * yRatio;
          e.attribute("preserveAspectRatio", true).value = "none";
        }

        // clear and render
        if (svg.opts["ignoreClear"] != true) {
          ctx.clearRect(0, 0, cWidth, cHeight);
        }
        e.render(ctx);
        if (isFirstRender) {
          isFirstRender = false;
          if (typeof svg.opts["renderCallback"] == "function")
            svg.opts["renderCallback"](dom);
        }
      };

      var waitingForImages = true;
      if (svg.ImagesLoaded()) {
        waitingForImages = false;
        draw();
      }
      svg.intervalID = setInterval(function () {
        var needUpdate = false;

        if (waitingForImages && svg.ImagesLoaded()) {
          waitingForImages = false;
          needUpdate = true;
        }

        // need update from mouse events?
        if (svg.opts["ignoreMouse"] != true) {
          needUpdate = needUpdate | svg.Mouse.hasEvents();
        }

        // need update from animations?
        if (svg.opts["ignoreAnimation"] != true) {
          for (var i = 0; i < svg.Animations.length; i++) {
            needUpdate =
              needUpdate | svg.Animations[i].update(1000 / svg.FRAMERATE);
          }
        }

        // need update from redraw?
        if (typeof svg.opts["forceRedraw"] == "function") {
          if (svg.opts["forceRedraw"]() == true) needUpdate = true;
        }

        // render if needed
        if (needUpdate) {
          draw();
          svg.Mouse.runEvents(); // run and clear our events
        }
      }, 1000 / svg.FRAMERATE);
    };

    svg.stop = function () {
      if (svg.intervalID) {
        clearInterval(svg.intervalID);
      }
    };

    svg.Mouse = new (function () {
      this.events = [];
      this.hasEvents = function () {
        return this.events.length != 0;
      };

      this.onclick = function (x, y) {
        this.events.push({
          type: "onclick",
          x: x,
          y: y,
          run: function (e) {
            if (e.onclick) e.onclick();
          },
        });
      };

      this.onmousemove = function (x, y) {
        this.events.push({
          type: "onmousemove",
          x: x,
          y: y,
          run: function (e) {
            if (e.onmousemove) e.onmousemove();
          },
        });
      };

      this.eventElements = [];

      this.checkPath = function (element, ctx) {
        for (var i = 0; i < this.events.length; i++) {
          var e = this.events[i];
          if (ctx.isPointInPath && ctx.isPointInPath(e.x, e.y))
            this.eventElements[i] = element;
        }
      };

      this.checkBoundingBox = function (element, bb) {
        for (var i = 0; i < this.events.length; i++) {
          var e = this.events[i];
          if (bb.isPointInBox(e.x, e.y)) this.eventElements[i] = element;
        }
      };

      this.runEvents = function () {
        svg.ctx.canvas.style.cursor = "";

        for (var i = 0; i < this.events.length; i++) {
          var e = this.events[i];
          var element = this.eventElements[i];
          while (element) {
            e.run(element);
            element = element.parent;
          }
        }

        // done running, clear
        this.events = [];
        this.eventElements = [];
      };
    })();

    return svg;
  }
})();

if (typeof CanvasRenderingContext2D != "undefined") {
  CanvasRenderingContext2D.prototype.drawSvg = function (s, dx, dy, dw, dh) {
    console.log('canvg3')
    canvg(this.canvas, s, {
      ignoreMouse: true,
      ignoreAnimation: true,
      ignoreDimensions: true,
      ignoreClear: true,
      offsetX: dx,
      offsetY: dy,
      scaleWidth: dw,
      scaleHeight: dh,
    });
  };
}
/*!
 * jQuery resizeend - A jQuery plugin that allows for window resize-end event handling.
 *
 * Copyright (c) 2015 Erik Nielsen
 *
 * Licensed under the MIT license:
 *    http://www.opensource.org/licenses/mit-license.php
 *
 * Project home:
 *    http://312development.com
 *
 * Version:  0.2.0
 *
 */

(function (plugin) {
  var chicago = window.Chicago || {
    utils: {
      now:
        Date.now ||
        function () {
          return new Date().getTime();
        },
      uid: function (prefix) {
        return (
          (prefix || "id") +
          chicago.utils.now() +
          "RAND" +
          Math.ceil(Math.random() * 1e5)
        );
      },
      is: {
        number: function (obj) {
          return !isNaN(parseFloat(obj)) && isFinite(obj);
        },
        fn: function (obj) {
          return typeof obj === "function";
        },
        object: function (obj) {
          return Object.prototype.toString.call(obj) === "[object Object]";
        },
      },
      debounce: function (fn, wait, immediate) {
        var timeout;
        return function () {
          var context = this,
            args = arguments,
            later = function () {
              timeout = null;
              if (!immediate) {
                fn.apply(context, args);
              }
            },
            callNow = immediate && !timeout;
          if (timeout) {
            clearTimeout(timeout);
          }
          timeout = setTimeout(later, wait);
          if (callNow) {
            fn.apply(context, args);
          }
        };
      },
    },
    $: window.jQuery || null,
  };
  if (typeof define === "function" && define.amd) {
    define("chicago", function () {
      chicago.load = function (res, req, onload, config) {
        var resources = res.split(","),
          load = [];
        var base = (config.config &&
        config.config.chicago &&
        config.config.chicago.base
          ? config.config.chicago.base
          : ""
        ).replace(/\/+$/g, "");
        if (!base) {
          throw new Error(
            "Please define base path to jQuery resize.end in the requirejs config."
          );
        }
        var i = 0;
        while (i < resources.length) {
          var resource = resources[i].replace(/\./g, "/");
          load.push(base + "/" + resource);
          i += 1;
        }
        req(load, function () {
          onload(chicago);
        });
      };
      return chicago;
    });
  }
  if (window && window.jQuery) {
    return plugin(chicago, window, window.document);
  } else {
    if (!window.jQuery) {
      throw new Error("jQuery resize.end requires jQuery");
    }
  }
})(function (_c, win, doc) {
  _c.$win = _c.$(win);
  _c.$doc = _c.$(doc);
  if (!_c.events) {
    _c.events = {};
  }
  _c.events.resizeend = {
    defaults: {
      delay: 250,
    },
    setup: function () {
      var args = arguments,
        options = {
          delay: _c.$.event.special.resizeend.defaults.delay,
        },
        fn;
      if (_c.utils.is.fn(args[0])) {
        fn = args[0];
      } else {
        if (_c.utils.is.number(args[0])) {
          options.delay = args[0];
        } else {
          if (_c.utils.is.object(args[0])) {
            options = _c.$.extend({}, options, args[0]);
          }
        }
      }
      var uid = _c.utils.uid("resizeend"),
        _data = _c.$.extend(
          {
            delay: _c.$.event.special.resizeend.defaults.delay,
          },
          options
        ),
        timer = _data,
        handler = function (e) {
          if (timer) {
            clearTimeout(timer);
          }
          timer = setTimeout(function () {
            timer = null;
            e.type = "resizeend.chicago.dom";
            return _c.$(e.target).trigger("resizeend", e);
          }, _data.delay);
        };
      _c.$(this).data("chicago.event.resizeend.uid", uid);
      return _c
        .$(this)
        .on("resize", _c.utils.debounce(handler, 100))
        .data(uid, handler);
    },
    teardown: function () {
      var uid = _c.$(this).data("chicago.event.resizeend.uid");
      _c.$(this).off("resize", _c.$(this).data(uid));
      _c.$(this).removeData(uid);
      return _c.$(this).removeData("chicago.event.resizeend.uid");
    },
  };
  (function () {
    _c.$.event.special.resizeend = _c.events.resizeend;
    _c.$.fn.resizeend = function (options, callback) {
      return this.each(function () {
        _c.$(this).on("resizeend", options, callback);
      });
    };
  })();
}); /*
 # INSPIRED BY: http://www.terracoder.com/
           AND: http://www.thomasfrank.se/xml_to_json.html
											AND: http://www.kawa.net/works/js/xml/objtree-e.html
*/ /*
 This simple script converts XML (document of code) into a JSON object. It is the combination of 2
 'xml to json' great parsers (see below) which allows for both 'simple' and 'extended' parsing modes.
*/ // Avoid collisions

/*
 ### jQuery XML to JSON Plugin v1.3 - 2013-02-18 ###
 * http://www.fyneworks.com/ - diego@fyneworks.com
	* Licensed under http://en.wikipedia.org/wiki/MIT_License
 ###
 Website: http://www.fyneworks.com/jquery/xml-to-json/
*/ if (
  window.jQuery
)
  (function ($) {
    // Add function to jQuery namespace
    $.extend({
      // converts xml documents and xml text to json object
      xml2json: function (xml, extended) {
        if (!xml) return {}; // quick fail

        //### PARSER LIBRARY
        // Core function
        function parseXML(node, simple) {
          if (!node) return null;
          var txt = "",
            obj = null,
            att = null;
          var nt = node.nodeType,
            nn = jsVar(node.localName || node.nodeName);
          var nv = node.text || node.nodeValue || "";

          if (node.childNodes) {
            if (node.childNodes.length > 0) {
              $.each(node.childNodes, function (n, cn) {
                var cnt = cn.nodeType,
                  cnn = jsVar(cn.localName || cn.nodeName);
                var cnv = cn.text || cn.nodeValue || "";

                if (cnt == 8) {
                  return; // ignore comment node
                } else if (cnt == 3 || cnt == 4 || !cnn) {
                  // ignore white-space in between tags
                  if (cnv.match(/^\s+$/)) {
                    return;
                  }

                  txt += cnv.replace(/^\s+/, "").replace(/\s+$/, "");
                  // make sure we ditch trailing spaces from markup
                } else {
                  obj = obj || {};
                  if (obj[cnn]) {
                    // http://forum.jquery.com/topic/jquery-jquery-xml2json-problems-when-siblings-of-the-same-tagname-only-have-a-textnode-as-a-child
                    if (!obj[cnn].length) obj[cnn] = myArr(obj[cnn]);
                    obj[cnn] = myArr(obj[cnn]);

                    obj[cnn][obj[cnn].length] = parseXML(cn, true /* simple */);
                    obj[cnn].length = obj[cnn].length;
                  } else {
                    obj[cnn] = parseXML(cn);
                  }
                }
              });
            } //node.childNodes.length>0
          } //node.childNodes
          if (node.attributes) {
            if (node.attributes.length > 0) {
              att = {};
              obj = obj || {};
              $.each(node.attributes, function (a, at) {
                var atn = jsVar(at.name),
                  atv = at.value;
                att[atn] = atv;
                if (obj[atn]) {
                  // http://forum.jquery.com/topic/jquery-jquery-xml2json-problems-when-siblings-of-the-same-tagname-only-have-a-textnode-as-a-child
                  //if(!obj[atn].length) obj[atn] = myArr(obj[atn]);//[ obj[ atn ] ];
                  obj[cnn] = myArr(obj[cnn]);

                  obj[atn][obj[atn].length] = atv;
                  obj[atn].length = obj[atn].length;
                } else {
                  obj[atn] = atv;
                }
              });
              //obj['attributes'] = att;
            } //node.attributes.length>0
          } //node.attributes
          if (obj) {
            obj = $.extend(
              txt != "" ? new String(txt) : {},
              /* {text:txt},*/ obj || {} /*, att || {}*/
            );
            //txt = (obj.text) ? (typeof(obj.text)=='object' ? obj.text : [obj.text || '']).concat([txt]) : txt;
            txt = obj.text ? [obj.text || ""].concat([txt]) : txt;
            if (txt) obj.text = txt;
            txt = "";
          }
          var out = obj || txt;

          if (extended) {
            if (txt) out = {}; //new String(out);
            txt = out.text || txt || "";
            if (txt) out.text = txt;
            if (!simple) out = myArr(out);
          }
          return out;
        } // parseXML
        // Core Function End
        // Utility functions
        var jsVar = function (s) {
          return String(s || "").replace(/-/g, "_");
        };

        // NEW isNum function: 01/09/2010
        // Thanks to Emile Grau, GigaTecnologies S.L., www.gigatransfer.com, www.mygigamail.com
        function isNum(s) {
          // based on utility function isNum from xml2json plugin (http://www.fyneworks.com/ - diego@fyneworks.com)
          // few bugs corrected from original function :
          // - syntax error : regexp.test(string) instead of string.test(reg)
          // - regexp modified to accept  comma as decimal mark (latin syntax : 25,24 )
          // - regexp modified to reject if no number before decimal mark  : ".7" is not accepted
          // - string is "trimmed", allowing to accept space at the beginning and end of string
          var regexp = /^((-)?([0-9]+)(([\.\,]{0,1})([0-9]+))?$)/;
          return (
            typeof s == "number" ||
            regexp.test(String(s && typeof s == "string" ? jQuery.trim(s) : ""))
          );
        }
        // OLD isNum function: (for reference only)
        //var isNum = function(s){ return (typeof s == "number") || String((s && typeof s == "string") ? s : '').test(/^((-)?([0-9]*)((\.{0,1})([0-9]+))?$)/); };

        var myArr = function (o) {
          // http://forum.jquery.com/topic/jquery-jquery-xml2json-problems-when-siblings-of-the-same-tagname-only-have-a-textnode-as-a-child
          //if(!o.length) o = [ o ]; o.length=o.length;
          if (!$.isArray(o)) o = [o];
          o.length = o.length;

          // here is where you can attach additional functionality, such as searching and sorting...
          return o;
        };
        // Utility functions End
        //### PARSER LIBRARY END

        // Convert plain text to xml
        if (typeof xml == "string") xml = $.text2xml(xml);

        // Quick fail if not xml (or if this is a node)
        if (!xml.nodeType) return;
        if (xml.nodeType == 3 || xml.nodeType == 4) return xml.nodeValue;

        // Find xml root node
        var root = xml.nodeType == 9 ? xml.documentElement : xml;

        // Convert xml to json
        var out = parseXML(root, true /* simple */);

        // Clean-up memory
        xml = null;
        root = null;

        // Send output
        return out;
      },

      // Convert text to XML DOM
      text2xml: function (str) {
        // NOTE: I'd like to use jQuery for this, but jQuery makes all tags uppercase
        //return $(xml)[0];

        /* prior to jquery 1.9 */
        /*
   var out;
   try{
    var xml = ((!$.support.opacity && !$.support.style))?new ActiveXObject("Microsoft.XMLDOM"):new DOMParser();
    xml.async = false;
   }catch(e){ throw new Error("XML Parser could not be instantiated") };
   try{
    if((!$.support.opacity && !$.support.style)) out = (xml.loadXML(str))?xml:false;
    else out = xml.parseFromString(str, "text/xml");
   }catch(e){ throw new Error("Error parsing XML string") };
   return out;
   */

        /* jquery 1.9+ */
        return $.parseXML(str);
      },
    }); // extend $
  })(jQuery);

// THIS FILE IS GENERATED - DO NOT EDIT!
/*global module:false, define:false*/

(function (define, undefined) {
  define(function () {
    "use strict";

    var impl = {};

    impl.mobileDetectRules = {
      phones: {
        iPhone: "\\biPhone\\b|\\biPod\\b",
        BlackBerry: "BlackBerry|\\bBB10\\b|rim[0-9]+",
        HTC:
          "HTC|HTC.*(Sensation|Evo|Vision|Explorer|6800|8100|8900|A7272|S510e|C110e|Legend|Desire|T8282)|APX515CKT|Qtek9090|APA9292KT|HD_mini|Sensation.*Z710e|PG86100|Z715e|Desire.*(A8181|HD)|ADR6200|ADR6400L|ADR6425|001HT|Inspire 4G|Android.*\\bEVO\\b|T-Mobile G1|Z520m",
        Nexus:
          "Nexus One|Nexus S|Galaxy.*Nexus|Android.*Nexus.*Mobile|Nexus 4|Nexus 5|Nexus 6",
        Dell:
          "Dell.*Streak|Dell.*Aero|Dell.*Venue|DELL.*Venue Pro|Dell Flash|Dell Smoke|Dell Mini 3iX|XCD28|XCD35|\\b001DL\\b|\\b101DL\\b|\\bGS01\\b",
        Motorola:
          "Motorola|DROIDX|DROID BIONIC|\\bDroid\\b.*Build|Android.*Xoom|HRI39|MOT-|A1260|A1680|A555|A853|A855|A953|A955|A956|Motorola.*ELECTRIFY|Motorola.*i1|i867|i940|MB200|MB300|MB501|MB502|MB508|MB511|MB520|MB525|MB526|MB611|MB612|MB632|MB810|MB855|MB860|MB861|MB865|MB870|ME501|ME502|ME511|ME525|ME600|ME632|ME722|ME811|ME860|ME863|ME865|MT620|MT710|MT716|MT720|MT810|MT870|MT917|Motorola.*TITANIUM|WX435|WX445|XT300|XT301|XT311|XT316|XT317|XT319|XT320|XT390|XT502|XT530|XT531|XT532|XT535|XT603|XT610|XT611|XT615|XT681|XT701|XT702|XT711|XT720|XT800|XT806|XT860|XT862|XT875|XT882|XT883|XT894|XT901|XT907|XT909|XT910|XT912|XT928|XT926|XT915|XT919|XT925|XT1021|\\bMoto E\\b",
        Samsung:
          "Samsung|SM-G9250|GT-19300|SGH-I337|BGT-S5230|GT-B2100|GT-B2700|GT-B2710|GT-B3210|GT-B3310|GT-B3410|GT-B3730|GT-B3740|GT-B5510|GT-B5512|GT-B5722|GT-B6520|GT-B7300|GT-B7320|GT-B7330|GT-B7350|GT-B7510|GT-B7722|GT-B7800|GT-C3010|GT-C3011|GT-C3060|GT-C3200|GT-C3212|GT-C3212I|GT-C3262|GT-C3222|GT-C3300|GT-C3300K|GT-C3303|GT-C3303K|GT-C3310|GT-C3322|GT-C3330|GT-C3350|GT-C3500|GT-C3510|GT-C3530|GT-C3630|GT-C3780|GT-C5010|GT-C5212|GT-C6620|GT-C6625|GT-C6712|GT-E1050|GT-E1070|GT-E1075|GT-E1080|GT-E1081|GT-E1085|GT-E1087|GT-E1100|GT-E1107|GT-E1110|GT-E1120|GT-E1125|GT-E1130|GT-E1160|GT-E1170|GT-E1175|GT-E1180|GT-E1182|GT-E1200|GT-E1210|GT-E1225|GT-E1230|GT-E1390|GT-E2100|GT-E2120|GT-E2121|GT-E2152|GT-E2220|GT-E2222|GT-E2230|GT-E2232|GT-E2250|GT-E2370|GT-E2550|GT-E2652|GT-E3210|GT-E3213|GT-I5500|GT-I5503|GT-I5700|GT-I5800|GT-I5801|GT-I6410|GT-I6420|GT-I7110|GT-I7410|GT-I7500|GT-I8000|GT-I8150|GT-I8160|GT-I8190|GT-I8320|GT-I8330|GT-I8350|GT-I8530|GT-I8700|GT-I8703|GT-I8910|GT-I9000|GT-I9001|GT-I9003|GT-I9010|GT-I9020|GT-I9023|GT-I9070|GT-I9082|GT-I9100|GT-I9103|GT-I9220|GT-I9250|GT-I9300|GT-I9305|GT-I9500|GT-I9505|GT-M3510|GT-M5650|GT-M7500|GT-M7600|GT-M7603|GT-M8800|GT-M8910|GT-N7000|GT-S3110|GT-S3310|GT-S3350|GT-S3353|GT-S3370|GT-S3650|GT-S3653|GT-S3770|GT-S3850|GT-S5210|GT-S5220|GT-S5229|GT-S5230|GT-S5233|GT-S5250|GT-S5253|GT-S5260|GT-S5263|GT-S5270|GT-S5300|GT-S5330|GT-S5350|GT-S5360|GT-S5363|GT-S5369|GT-S5380|GT-S5380D|GT-S5560|GT-S5570|GT-S5600|GT-S5603|GT-S5610|GT-S5620|GT-S5660|GT-S5670|GT-S5690|GT-S5750|GT-S5780|GT-S5830|GT-S5839|GT-S6102|GT-S6500|GT-S7070|GT-S7200|GT-S7220|GT-S7230|GT-S7233|GT-S7250|GT-S7500|GT-S7530|GT-S7550|GT-S7562|GT-S7710|GT-S8000|GT-S8003|GT-S8500|GT-S8530|GT-S8600|SCH-A310|SCH-A530|SCH-A570|SCH-A610|SCH-A630|SCH-A650|SCH-A790|SCH-A795|SCH-A850|SCH-A870|SCH-A890|SCH-A930|SCH-A950|SCH-A970|SCH-A990|SCH-I100|SCH-I110|SCH-I400|SCH-I405|SCH-I500|SCH-I510|SCH-I515|SCH-I600|SCH-I730|SCH-I760|SCH-I770|SCH-I830|SCH-I910|SCH-I920|SCH-I959|SCH-LC11|SCH-N150|SCH-N300|SCH-R100|SCH-R300|SCH-R351|SCH-R400|SCH-R410|SCH-T300|SCH-U310|SCH-U320|SCH-U350|SCH-U360|SCH-U365|SCH-U370|SCH-U380|SCH-U410|SCH-U430|SCH-U450|SCH-U460|SCH-U470|SCH-U490|SCH-U540|SCH-U550|SCH-U620|SCH-U640|SCH-U650|SCH-U660|SCH-U700|SCH-U740|SCH-U750|SCH-U810|SCH-U820|SCH-U900|SCH-U940|SCH-U960|SCS-26UC|SGH-A107|SGH-A117|SGH-A127|SGH-A137|SGH-A157|SGH-A167|SGH-A177|SGH-A187|SGH-A197|SGH-A227|SGH-A237|SGH-A257|SGH-A437|SGH-A517|SGH-A597|SGH-A637|SGH-A657|SGH-A667|SGH-A687|SGH-A697|SGH-A707|SGH-A717|SGH-A727|SGH-A737|SGH-A747|SGH-A767|SGH-A777|SGH-A797|SGH-A817|SGH-A827|SGH-A837|SGH-A847|SGH-A867|SGH-A877|SGH-A887|SGH-A897|SGH-A927|SGH-B100|SGH-B130|SGH-B200|SGH-B220|SGH-C100|SGH-C110|SGH-C120|SGH-C130|SGH-C140|SGH-C160|SGH-C170|SGH-C180|SGH-C200|SGH-C207|SGH-C210|SGH-C225|SGH-C230|SGH-C417|SGH-C450|SGH-D307|SGH-D347|SGH-D357|SGH-D407|SGH-D415|SGH-D780|SGH-D807|SGH-D980|SGH-E105|SGH-E200|SGH-E315|SGH-E316|SGH-E317|SGH-E335|SGH-E590|SGH-E635|SGH-E715|SGH-E890|SGH-F300|SGH-F480|SGH-I200|SGH-I300|SGH-I320|SGH-I550|SGH-I577|SGH-I600|SGH-I607|SGH-I617|SGH-I627|SGH-I637|SGH-I677|SGH-I700|SGH-I717|SGH-I727|SGH-i747M|SGH-I777|SGH-I780|SGH-I827|SGH-I847|SGH-I857|SGH-I896|SGH-I897|SGH-I900|SGH-I907|SGH-I917|SGH-I927|SGH-I937|SGH-I997|SGH-J150|SGH-J200|SGH-L170|SGH-L700|SGH-M110|SGH-M150|SGH-M200|SGH-N105|SGH-N500|SGH-N600|SGH-N620|SGH-N625|SGH-N700|SGH-N710|SGH-P107|SGH-P207|SGH-P300|SGH-P310|SGH-P520|SGH-P735|SGH-P777|SGH-Q105|SGH-R210|SGH-R220|SGH-R225|SGH-S105|SGH-S307|SGH-T109|SGH-T119|SGH-T139|SGH-T209|SGH-T219|SGH-T229|SGH-T239|SGH-T249|SGH-T259|SGH-T309|SGH-T319|SGH-T329|SGH-T339|SGH-T349|SGH-T359|SGH-T369|SGH-T379|SGH-T409|SGH-T429|SGH-T439|SGH-T459|SGH-T469|SGH-T479|SGH-T499|SGH-T509|SGH-T519|SGH-T539|SGH-T559|SGH-T589|SGH-T609|SGH-T619|SGH-T629|SGH-T639|SGH-T659|SGH-T669|SGH-T679|SGH-T709|SGH-T719|SGH-T729|SGH-T739|SGH-T746|SGH-T749|SGH-T759|SGH-T769|SGH-T809|SGH-T819|SGH-T839|SGH-T919|SGH-T929|SGH-T939|SGH-T959|SGH-T989|SGH-U100|SGH-U200|SGH-U800|SGH-V205|SGH-V206|SGH-X100|SGH-X105|SGH-X120|SGH-X140|SGH-X426|SGH-X427|SGH-X475|SGH-X495|SGH-X497|SGH-X507|SGH-X600|SGH-X610|SGH-X620|SGH-X630|SGH-X700|SGH-X820|SGH-X890|SGH-Z130|SGH-Z150|SGH-Z170|SGH-ZX10|SGH-ZX20|SHW-M110|SPH-A120|SPH-A400|SPH-A420|SPH-A460|SPH-A500|SPH-A560|SPH-A600|SPH-A620|SPH-A660|SPH-A700|SPH-A740|SPH-A760|SPH-A790|SPH-A800|SPH-A820|SPH-A840|SPH-A880|SPH-A900|SPH-A940|SPH-A960|SPH-D600|SPH-D700|SPH-D710|SPH-D720|SPH-I300|SPH-I325|SPH-I330|SPH-I350|SPH-I500|SPH-I600|SPH-I700|SPH-L700|SPH-M100|SPH-M220|SPH-M240|SPH-M300|SPH-M305|SPH-M320|SPH-M330|SPH-M350|SPH-M360|SPH-M370|SPH-M380|SPH-M510|SPH-M540|SPH-M550|SPH-M560|SPH-M570|SPH-M580|SPH-M610|SPH-M620|SPH-M630|SPH-M800|SPH-M810|SPH-M850|SPH-M900|SPH-M910|SPH-M920|SPH-M930|SPH-N100|SPH-N200|SPH-N240|SPH-N300|SPH-N400|SPH-Z400|SWC-E100|SCH-i909|GT-N7100|GT-N7105|SCH-I535|SM-N900A|SGH-I317|SGH-T999L|GT-S5360B|GT-I8262|GT-S6802|GT-S6312|GT-S6310|GT-S5312|GT-S5310|GT-I9105|GT-I8510|GT-S6790N|SM-G7105|SM-N9005|GT-S5301|GT-I9295|GT-I9195|SM-C101|GT-S7392|GT-S7560|GT-B7610|GT-I5510|GT-S7582|GT-S7530E|GT-I8750|SM-G9006V|SM-G9008V|SM-G9009D|SM-G900A|SM-G900D|SM-G900F|SM-G900H|SM-G900I|SM-G900J|SM-G900K|SM-G900L|SM-G900M|SM-G900P|SM-G900R4|SM-G900S|SM-G900T|SM-G900V|SM-G900W8|SHV-E160K|SCH-P709|SCH-P729|SM-T2558|GT-I9205",
        LG:
          "\\bLG\\b;|LG[- ]?(C800|C900|E400|E610|E900|E-900|F160|F180K|F180L|F180S|730|855|L160|LS740|LS840|LS970|LU6200|MS690|MS695|MS770|MS840|MS870|MS910|P500|P700|P705|VM696|AS680|AS695|AX840|C729|E970|GS505|272|C395|E739BK|E960|L55C|L75C|LS696|LS860|P769BK|P350|P500|P509|P870|UN272|US730|VS840|VS950|LN272|LN510|LS670|LS855|LW690|MN270|MN510|P509|P769|P930|UN200|UN270|UN510|UN610|US670|US740|US760|UX265|UX840|VN271|VN530|VS660|VS700|VS740|VS750|VS910|VS920|VS930|VX9200|VX11000|AX840A|LW770|P506|P925|P999|E612|D955|D802|MS323)",
        Sony:
          "SonyST|SonyLT|SonyEricsson|SonyEricssonLT15iv|LT18i|E10i|LT28h|LT26w|SonyEricssonMT27i|C5303|C6902|C6903|C6906|C6943|D2533",
        Asus: "Asus.*Galaxy|PadFone.*Mobile",
        Micromax:
          "Micromax.*\\b(A210|A92|A88|A72|A111|A110Q|A115|A116|A110|A90S|A26|A51|A35|A54|A25|A27|A89|A68|A65|A57|A90)\\b",
        Palm: "PalmSource|Palm",
        Vertu:
          "Vertu|Vertu.*Ltd|Vertu.*Ascent|Vertu.*Ayxta|Vertu.*Constellation(F|Quest)?|Vertu.*Monika|Vertu.*Signature",
        Pantech:
          "PANTECH|IM-A850S|IM-A840S|IM-A830L|IM-A830K|IM-A830S|IM-A820L|IM-A810K|IM-A810S|IM-A800S|IM-T100K|IM-A725L|IM-A780L|IM-A775C|IM-A770K|IM-A760S|IM-A750K|IM-A740S|IM-A730S|IM-A720L|IM-A710K|IM-A690L|IM-A690S|IM-A650S|IM-A630K|IM-A600S|VEGA PTL21|PT003|P8010|ADR910L|P6030|P6020|P9070|P4100|P9060|P5000|CDM8992|TXT8045|ADR8995|IS11PT|P2030|P6010|P8000|PT002|IS06|CDM8999|P9050|PT001|TXT8040|P2020|P9020|P2000|P7040|P7000|C790",
        Fly:
          "IQ230|IQ444|IQ450|IQ440|IQ442|IQ441|IQ245|IQ256|IQ236|IQ255|IQ235|IQ245|IQ275|IQ240|IQ285|IQ280|IQ270|IQ260|IQ250",
        Wiko:
          "KITE 4G|HIGHWAY|GETAWAY|STAIRWAY|DARKSIDE|DARKFULL|DARKNIGHT|DARKMOON|SLIDE|WAX 4G|RAINBOW|BLOOM|SUNSET|GOA|LENNY|BARRY|IGGY|OZZY|CINK FIVE|CINK PEAX|CINK PEAX 2|CINK SLIM|CINK SLIM 2|CINK +|CINK KING|CINK PEAX|CINK SLIM|SUBLIM",
        iMobile: "i-mobile (IQ|i-STYLE|idea|ZAA|Hitz)",
        SimValley:
          "\\b(SP-80|XT-930|SX-340|XT-930|SX-310|SP-360|SP60|SPT-800|SP-120|SPT-800|SP-140|SPX-5|SPX-8|SP-100|SPX-8|SPX-12)\\b",
        Wolfgang:
          "AT-B24D|AT-AS50HD|AT-AS40W|AT-AS55HD|AT-AS45q2|AT-B26D|AT-AS50Q",
        Alcatel: "Alcatel",
        Nintendo: "Nintendo 3DS",
        Amoi: "Amoi",
        INQ: "INQ",
        GenericPhone:
          "Tapatalk|PDA;|SAGEM|\\bmmp\\b|pocket|\\bpsp\\b|symbian|Smartphone|smartfon|treo|up.browser|up.link|vodafone|\\bwap\\b|nokia|Series40|Series60|S60|SonyEricsson|N900|MAUI.*WAP.*Browser",
      },
      tablets: {
        iPad: "iPad|iPad.*Mobile",
        NexusTablet: "Android.*Nexus[\\s]+(7|9|10)",
        SamsungTablet:
          "SAMSUNG.*Tablet|Galaxy.*Tab|SC-01C|GT-P1000|GT-P1003|GT-P1010|GT-P3105|GT-P6210|GT-P6800|GT-P6810|GT-P7100|GT-P7300|GT-P7310|GT-P7500|GT-P7510|SCH-I800|SCH-I815|SCH-I905|SGH-I957|SGH-I987|SGH-T849|SGH-T859|SGH-T869|SPH-P100|GT-P3100|GT-P3108|GT-P3110|GT-P5100|GT-P5110|GT-P6200|GT-P7320|GT-P7511|GT-N8000|GT-P8510|SGH-I497|SPH-P500|SGH-T779|SCH-I705|SCH-I915|GT-N8013|GT-P3113|GT-P5113|GT-P8110|GT-N8010|GT-N8005|GT-N8020|GT-P1013|GT-P6201|GT-P7501|GT-N5100|GT-N5105|GT-N5110|SHV-E140K|SHV-E140L|SHV-E140S|SHV-E150S|SHV-E230K|SHV-E230L|SHV-E230S|SHW-M180K|SHW-M180L|SHW-M180S|SHW-M180W|SHW-M300W|SHW-M305W|SHW-M380K|SHW-M380S|SHW-M380W|SHW-M430W|SHW-M480K|SHW-M480S|SHW-M480W|SHW-M485W|SHW-M486W|SHW-M500W|GT-I9228|SCH-P739|SCH-I925|GT-I9200|GT-P5200|GT-P5210|GT-P5210X|SM-T311|SM-T310|SM-T310X|SM-T210|SM-T210R|SM-T211|SM-P600|SM-P601|SM-P605|SM-P900|SM-P901|SM-T217|SM-T217A|SM-T217S|SM-P6000|SM-T3100|SGH-I467|XE500|SM-T110|GT-P5220|GT-I9200X|GT-N5110X|GT-N5120|SM-P905|SM-T111|SM-T2105|SM-T315|SM-T320|SM-T320X|SM-T321|SM-T520|SM-T525|SM-T530NU|SM-T230NU|SM-T330NU|SM-T900|XE500T1C|SM-P605V|SM-P905V|SM-T337V|SM-T537V|SM-T707V|SM-T807V|SM-P600X|SM-P900X|SM-T210X|SM-T230|SM-T230X|SM-T325|GT-P7503|SM-T531|SM-T330|SM-T530|SM-T705|SM-T705C|SM-T535|SM-T331|SM-T800|SM-T700|SM-T537|SM-T807|SM-P907A|SM-T337A|SM-T537A|SM-T707A|SM-T807A|SM-T237|SM-T807P|SM-P607T|SM-T217T|SM-T337T|SM-T807T|SM-T116NQ|SM-P550|SM-T350|SM-T550|SM-T9000|SM-P9000|SM-T705Y|SM-T805|GT-P3113|SM-T710|SM-T810|SM-T360|SM-T533|SM-T113|SM-T335|SM-T715",
        Kindle:
          "Kindle|Silk.*Accelerated|Android.*\\b(KFOT|KFTT|KFJWI|KFJWA|KFOTE|KFSOWI|KFTHWI|KFTHWA|KFAPWI|KFAPWA|WFJWAE|KFSAWA|KFSAWI|KFASWI)\\b",
        SurfaceTablet: "Windows NT [0-9.]+; ARM;.*(Tablet|ARMBJS)",
        HPTablet:
          "HP Slate (7|8|10)|HP ElitePad 900|hp-tablet|EliteBook.*Touch|HP 8|Slate 21|HP SlateBook 10",
        AsusTablet:
          "^.*PadFone((?!Mobile).)*$|Transformer|TF101|TF101G|TF300T|TF300TG|TF300TL|TF700T|TF700KL|TF701T|TF810C|ME171|ME301T|ME302C|ME371MG|ME370T|ME372MG|ME172V|ME173X|ME400C|Slider SL101|\\bK00F\\b|\\bK00C\\b|\\bK00E\\b|\\bK00L\\b|TX201LA|ME176C|ME102A|\\bM80TA\\b|ME372CL|ME560CG|ME372CG|ME302KL| K010 | K017 |ME572C|ME103K|ME170C|ME171C|\\bME70C\\b|ME581C|ME581CL|ME8510C|ME181C",
        BlackBerryTablet: "PlayBook|RIM Tablet",
        HTCtablet:
          "HTC_Flyer_P512|HTC Flyer|HTC Jetstream|HTC-P715a|HTC EVO View 4G|PG41200|PG09410",
        MotorolaTablet:
          "xoom|sholest|MZ615|MZ605|MZ505|MZ601|MZ602|MZ603|MZ604|MZ606|MZ607|MZ608|MZ609|MZ615|MZ616|MZ617",
        NookTablet:
          "Android.*Nook|NookColor|nook browser|BNRV200|BNRV200A|BNTV250|BNTV250A|BNTV400|BNTV600|LogicPD Zoom2",
        AcerTablet:
          "Android.*; \\b(A100|A101|A110|A200|A210|A211|A500|A501|A510|A511|A700|A701|W500|W500P|W501|W501P|W510|W511|W700|G100|G100W|B1-A71|B1-710|B1-711|A1-810|A1-811|A1-830)\\b|W3-810|\\bA3-A10\\b|\\bA3-A11\\b",
        ToshibaTablet:
          "Android.*(AT100|AT105|AT200|AT205|AT270|AT275|AT300|AT305|AT1S5|AT500|AT570|AT700|AT830)|TOSHIBA.*FOLIO",
        LGTablet:
          "\\bL-06C|LG-V909|LG-V900|LG-V700|LG-V510|LG-V500|LG-V410|LG-V400|LG-VK810\\b",
        FujitsuTablet: "Android.*\\b(F-01D|F-02F|F-05E|F-10D|M532|Q572)\\b",
        PrestigioTablet:
          "PMP3170B|PMP3270B|PMP3470B|PMP7170B|PMP3370B|PMP3570C|PMP5870C|PMP3670B|PMP5570C|PMP5770D|PMP3970B|PMP3870C|PMP5580C|PMP5880D|PMP5780D|PMP5588C|PMP7280C|PMP7280C3G|PMP7280|PMP7880D|PMP5597D|PMP5597|PMP7100D|PER3464|PER3274|PER3574|PER3884|PER5274|PER5474|PMP5097CPRO|PMP5097|PMP7380D|PMP5297C|PMP5297C_QUAD|PMP812E|PMP812E3G|PMP812F|PMP810E|PMP880TD|PMT3017|PMT3037|PMT3047|PMT3057|PMT7008|PMT5887|PMT5001|PMT5002",
        LenovoTablet:
          "Idea(Tab|Pad)( A1|A10| K1|)|ThinkPad([ ]+)?Tablet|Lenovo.*(S2109|S2110|S5000|S6000|K3011|A3000|A3500|A1000|A2107|A2109|A1107|A5500|A7600|B6000|B8000|B8080)(-|)(FL|F|HV|H|)",
        DellTablet: "Venue 11|Venue 8|Venue 7|Dell Streak 10|Dell Streak 7",
        YarvikTablet:
          "Android.*\\b(TAB210|TAB211|TAB224|TAB250|TAB260|TAB264|TAB310|TAB360|TAB364|TAB410|TAB411|TAB420|TAB424|TAB450|TAB460|TAB461|TAB464|TAB465|TAB467|TAB468|TAB07-100|TAB07-101|TAB07-150|TAB07-151|TAB07-152|TAB07-200|TAB07-201-3G|TAB07-210|TAB07-211|TAB07-212|TAB07-214|TAB07-220|TAB07-400|TAB07-485|TAB08-150|TAB08-200|TAB08-201-3G|TAB08-201-30|TAB09-100|TAB09-211|TAB09-410|TAB10-150|TAB10-201|TAB10-211|TAB10-400|TAB10-410|TAB13-201|TAB274EUK|TAB275EUK|TAB374EUK|TAB462EUK|TAB474EUK|TAB9-200)\\b",
        MedionTablet:
          "Android.*\\bOYO\\b|LIFE.*(P9212|P9514|P9516|S9512)|LIFETAB",
        ArnovaTablet:
          "AN10G2|AN7bG3|AN7fG3|AN8G3|AN8cG3|AN7G3|AN9G3|AN7dG3|AN7dG3ST|AN7dG3ChildPad|AN10bG3|AN10bG3DT|AN9G2",
        IntensoTablet: "INM8002KP|INM1010FP|INM805ND|Intenso Tab|TAB1004",
        IRUTablet: "M702pro",
        MegafonTablet: "MegaFon V9|\\bZTE V9\\b|Android.*\\bMT7A\\b",
        EbodaTablet: "E-Boda (Supreme|Impresspeed|Izzycomm|Essential)",
        AllViewTablet:
          "Allview.*(Viva|Alldro|City|Speed|All TV|Frenzy|Quasar|Shine|TX1|AX1|AX2)",
        ArchosTablet:
          "\\b(101G9|80G9|A101IT)\\b|Qilive 97R|Archos5|\\bARCHOS (70|79|80|90|97|101|FAMILYPAD|)(b|)(G10| Cobalt| TITANIUM(HD|)| Xenon| Neon|XSK| 2| XS 2| PLATINUM| CARBON|GAMEPAD)\\b",
        AinolTablet:
          "NOVO7|NOVO8|NOVO10|Novo7Aurora|Novo7Basic|NOVO7PALADIN|novo9-Spark",
        SonyTablet:
          "Sony.*Tablet|Xperia Tablet|Sony Tablet S|SO-03E|SGPT12|SGPT13|SGPT114|SGPT121|SGPT122|SGPT123|SGPT111|SGPT112|SGPT113|SGPT131|SGPT132|SGPT133|SGPT211|SGPT212|SGPT213|SGP311|SGP312|SGP321|EBRD1101|EBRD1102|EBRD1201|SGP351|SGP341|SGP511|SGP512|SGP521|SGP541|SGP551|SGP621|SGP612|SOT31",
        PhilipsTablet:
          "\\b(PI2010|PI3000|PI3100|PI3105|PI3110|PI3205|PI3210|PI3900|PI4010|PI7000|PI7100)\\b",
        CubeTablet:
          "Android.*(K8GT|U9GT|U10GT|U16GT|U17GT|U18GT|U19GT|U20GT|U23GT|U30GT)|CUBE U8GT",
        CobyTablet:
          "MID1042|MID1045|MID1125|MID1126|MID7012|MID7014|MID7015|MID7034|MID7035|MID7036|MID7042|MID7048|MID7127|MID8042|MID8048|MID8127|MID9042|MID9740|MID9742|MID7022|MID7010",
        MIDTablet:
          "M9701|M9000|M9100|M806|M1052|M806|T703|MID701|MID713|MID710|MID727|MID760|MID830|MID728|MID933|MID125|MID810|MID732|MID120|MID930|MID800|MID731|MID900|MID100|MID820|MID735|MID980|MID130|MID833|MID737|MID960|MID135|MID860|MID736|MID140|MID930|MID835|MID733",
        MSITablet:
          "MSI \\b(Primo 73K|Primo 73L|Primo 81L|Primo 77|Primo 93|Primo 75|Primo 76|Primo 73|Primo 81|Primo 91|Primo 90|Enjoy 71|Enjoy 7|Enjoy 10)\\b",
        SMiTTablet:
          "Android.*(\\bMID\\b|MID-560|MTV-T1200|MTV-PND531|MTV-P1101|MTV-PND530)",
        RockChipTablet:
          "Android.*(RK2818|RK2808A|RK2918|RK3066)|RK2738|RK2808A",
        FlyTablet: "IQ310|Fly Vision",
        bqTablet:
          "Android.*(bq)?.*(Elcano|Curie|Edison|Maxwell|Kepler|Pascal|Tesla|Hypatia|Platon|Newton|Livingstone|Cervantes|Avant|Aquaris E10)|Maxwell.*Lite|Maxwell.*Plus",
        HuaweiTablet:
          "MediaPad|MediaPad 7 Youth|IDEOS S7|S7-201c|S7-202u|S7-101|S7-103|S7-104|S7-105|S7-106|S7-201|S7-Slim",
        NecTablet: "\\bN-06D|\\bN-08D",
        PantechTablet: "Pantech.*P4100",
        BronchoTablet: "Broncho.*(N701|N708|N802|a710)",
        VersusTablet: "TOUCHPAD.*[78910]|\\bTOUCHTAB\\b",
        ZyncTablet: "z1000|Z99 2G|z99|z930|z999|z990|z909|Z919|z900",
        PositivoTablet: "TB07STA|TB10STA|TB07FTA|TB10FTA",
        NabiTablet: "Android.*\\bNabi",
        KoboTablet: "Kobo Touch|\\bK080\\b|\\bVox\\b Build|\\bArc\\b Build",
        DanewTablet:
          "DSlide.*\\b(700|701R|702|703R|704|802|970|971|972|973|974|1010|1012)\\b",
        TexetTablet:
          "NaviPad|TB-772A|TM-7045|TM-7055|TM-9750|TM-7016|TM-7024|TM-7026|TM-7041|TM-7043|TM-7047|TM-8041|TM-9741|TM-9747|TM-9748|TM-9751|TM-7022|TM-7021|TM-7020|TM-7011|TM-7010|TM-7023|TM-7025|TM-7037W|TM-7038W|TM-7027W|TM-9720|TM-9725|TM-9737W|TM-1020|TM-9738W|TM-9740|TM-9743W|TB-807A|TB-771A|TB-727A|TB-725A|TB-719A|TB-823A|TB-805A|TB-723A|TB-715A|TB-707A|TB-705A|TB-709A|TB-711A|TB-890HD|TB-880HD|TB-790HD|TB-780HD|TB-770HD|TB-721HD|TB-710HD|TB-434HD|TB-860HD|TB-840HD|TB-760HD|TB-750HD|TB-740HD|TB-730HD|TB-722HD|TB-720HD|TB-700HD|TB-500HD|TB-470HD|TB-431HD|TB-430HD|TB-506|TB-504|TB-446|TB-436|TB-416|TB-146SE|TB-126SE",
        PlaystationTablet: "Playstation.*(Portable|Vita)",
        TrekstorTablet:
          "ST10416-1|VT10416-1|ST70408-1|ST702xx-1|ST702xx-2|ST80208|ST97216|ST70104-2|VT10416-2|ST10216-2A|SurfTab",
        PyleAudioTablet:
          "\\b(PTBL10CEU|PTBL10C|PTBL72BC|PTBL72BCEU|PTBL7CEU|PTBL7C|PTBL92BC|PTBL92BCEU|PTBL9CEU|PTBL9CUK|PTBL9C)\\b",
        AdvanTablet:
          "Android.* \\b(E3A|T3X|T5C|T5B|T3E|T3C|T3B|T1J|T1F|T2A|T1H|T1i|E1C|T1-E|T5-A|T4|E1-B|T2Ci|T1-B|T1-D|O1-A|E1-A|T1-A|T3A|T4i)\\b ",
        DanyTechTablet:
          "Genius Tab G3|Genius Tab S2|Genius Tab Q3|Genius Tab G4|Genius Tab Q4|Genius Tab G-II|Genius TAB GII|Genius TAB GIII|Genius Tab S1",
        GalapadTablet: "Android.*\\bG1\\b",
        MicromaxTablet:
          "Funbook|Micromax.*\\b(P250|P560|P360|P362|P600|P300|P350|P500|P275)\\b",
        KarbonnTablet:
          "Android.*\\b(A39|A37|A34|ST8|ST10|ST7|Smart Tab3|Smart Tab2)\\b",
        AllFineTablet:
          "Fine7 Genius|Fine7 Shine|Fine7 Air|Fine8 Style|Fine9 More|Fine10 Joy|Fine11 Wide",
        PROSCANTablet:
          "\\b(PEM63|PLT1023G|PLT1041|PLT1044|PLT1044G|PLT1091|PLT4311|PLT4311PL|PLT4315|PLT7030|PLT7033|PLT7033D|PLT7035|PLT7035D|PLT7044K|PLT7045K|PLT7045KB|PLT7071KG|PLT7072|PLT7223G|PLT7225G|PLT7777G|PLT7810K|PLT7849G|PLT7851G|PLT7852G|PLT8015|PLT8031|PLT8034|PLT8036|PLT8080K|PLT8082|PLT8088|PLT8223G|PLT8234G|PLT8235G|PLT8816K|PLT9011|PLT9045K|PLT9233G|PLT9735|PLT9760G|PLT9770G)\\b",
        YONESTablet:
          "BQ1078|BC1003|BC1077|RK9702|BC9730|BC9001|IT9001|BC7008|BC7010|BC708|BC728|BC7012|BC7030|BC7027|BC7026",
        ChangJiaTablet:
          "TPC7102|TPC7103|TPC7105|TPC7106|TPC7107|TPC7201|TPC7203|TPC7205|TPC7210|TPC7708|TPC7709|TPC7712|TPC7110|TPC8101|TPC8103|TPC8105|TPC8106|TPC8203|TPC8205|TPC8503|TPC9106|TPC9701|TPC97101|TPC97103|TPC97105|TPC97106|TPC97111|TPC97113|TPC97203|TPC97603|TPC97809|TPC97205|TPC10101|TPC10103|TPC10106|TPC10111|TPC10203|TPC10205|TPC10503",
        GUTablet: "TX-A1301|TX-M9002|Q702|kf026",
        PointOfViewTablet:
          "TAB-P506|TAB-navi-7-3G-M|TAB-P517|TAB-P-527|TAB-P701|TAB-P703|TAB-P721|TAB-P731N|TAB-P741|TAB-P825|TAB-P905|TAB-P925|TAB-PR945|TAB-PL1015|TAB-P1025|TAB-PI1045|TAB-P1325|TAB-PROTAB[0-9]+|TAB-PROTAB25|TAB-PROTAB26|TAB-PROTAB27|TAB-PROTAB26XL|TAB-PROTAB2-IPS9|TAB-PROTAB30-IPS9|TAB-PROTAB25XXL|TAB-PROTAB26-IPS10|TAB-PROTAB30-IPS10",
        OvermaxTablet:
          "OV-(SteelCore|NewBase|Basecore|Baseone|Exellen|Quattor|EduTab|Solution|ACTION|BasicTab|TeddyTab|MagicTab|Stream|TB-08|TB-09)",
        HCLTablet:
          "HCL.*Tablet|Connect-3G-2.0|Connect-2G-2.0|ME Tablet U1|ME Tablet U2|ME Tablet G1|ME Tablet X1|ME Tablet Y2|ME Tablet Sync",
        DPSTablet: "DPS Dream 9|DPS Dual 7",
        VistureTablet:
          "V97 HD|i75 3G|Visture V4( HD)?|Visture V5( HD)?|Visture V10",
        CrestaTablet:
          "CTP(-)?810|CTP(-)?818|CTP(-)?828|CTP(-)?838|CTP(-)?888|CTP(-)?978|CTP(-)?980|CTP(-)?987|CTP(-)?988|CTP(-)?989",
        MediatekTablet: "\\bMT8125|MT8389|MT8135|MT8377\\b",
        ConcordeTablet: "Concorde([ ]+)?Tab|ConCorde ReadMan",
        GoCleverTablet:
          "GOCLEVER TAB|A7GOCLEVER|M1042|M7841|M742|R1042BK|R1041|TAB A975|TAB A7842|TAB A741|TAB A741L|TAB M723G|TAB M721|TAB A1021|TAB I921|TAB R721|TAB I720|TAB T76|TAB R70|TAB R76.2|TAB R106|TAB R83.2|TAB M813G|TAB I721|GCTA722|TAB I70|TAB I71|TAB S73|TAB R73|TAB R74|TAB R93|TAB R75|TAB R76.1|TAB A73|TAB A93|TAB A93.2|TAB T72|TAB R83|TAB R974|TAB R973|TAB A101|TAB A103|TAB A104|TAB A104.2|R105BK|M713G|A972BK|TAB A971|TAB R974.2|TAB R104|TAB R83.3|TAB A1042",
        ModecomTablet:
          "FreeTAB 9000|FreeTAB 7.4|FreeTAB 7004|FreeTAB 7800|FreeTAB 2096|FreeTAB 7.5|FreeTAB 1014|FreeTAB 1001 |FreeTAB 8001|FreeTAB 9706|FreeTAB 9702|FreeTAB 7003|FreeTAB 7002|FreeTAB 1002|FreeTAB 7801|FreeTAB 1331|FreeTAB 1004|FreeTAB 8002|FreeTAB 8014|FreeTAB 9704|FreeTAB 1003",
        VoninoTablet:
          "\\b(Argus[ _]?S|Diamond[ _]?79HD|Emerald[ _]?78E|Luna[ _]?70C|Onyx[ _]?S|Onyx[ _]?Z|Orin[ _]?HD|Orin[ _]?S|Otis[ _]?S|SpeedStar[ _]?S|Magnet[ _]?M9|Primus[ _]?94[ _]?3G|Primus[ _]?94HD|Primus[ _]?QS|Android.*\\bQ8\\b|Sirius[ _]?EVO[ _]?QS|Sirius[ _]?QS|Spirit[ _]?S)\\b",
        ECSTablet: "V07OT2|TM105A|S10OT1|TR10CS1",
        StorexTablet: "eZee[_']?(Tab|Go)[0-9]+|TabLC7|Looney Tunes Tab",
        VodafoneTablet: "SmartTab([ ]+)?[0-9]+|SmartTabII10|SmartTabII7",
        EssentielBTablet: "Smart[ ']?TAB[ ]+?[0-9]+|Family[ ']?TAB2",
        RossMoorTablet:
          "RM-790|RM-997|RMD-878G|RMD-974R|RMT-705A|RMT-701|RME-601|RMT-501|RMT-711",
        iMobileTablet: "i-mobile i-note",
        TolinoTablet: "tolino tab [0-9.]+|tolino shine",
        AudioSonicTablet: "\\bC-22Q|T7-QC|T-17B|T-17P\\b",
        AMPETablet: "Android.* A78 ",
        SkkTablet: "Android.* (SKYPAD|PHOENIX|CYCLOPS)",
        TecnoTablet: "TECNO P9",
        JXDTablet:
          "Android.*\\b(F3000|A3300|JXD5000|JXD3000|JXD2000|JXD300B|JXD300|S5800|S7800|S602b|S5110b|S7300|S5300|S602|S603|S5100|S5110|S601|S7100a|P3000F|P3000s|P101|P200s|P1000m|P200m|P9100|P1000s|S6600b|S908|P1000|P300|S18|S6600|S9100)\\b",
        iJoyTablet:
          "Tablet (Spirit 7|Essentia|Galatea|Fusion|Onix 7|Landa|Titan|Scooby|Deox|Stella|Themis|Argon|Unique 7|Sygnus|Hexen|Finity 7|Cream|Cream X2|Jade|Neon 7|Neron 7|Kandy|Scape|Saphyr 7|Rebel|Biox|Rebel|Rebel 8GB|Myst|Draco 7|Myst|Tab7-004|Myst|Tadeo Jones|Tablet Boing|Arrow|Draco Dual Cam|Aurix|Mint|Amity|Revolution|Finity 9|Neon 9|T9w|Amity 4GB Dual Cam|Stone 4GB|Stone 8GB|Andromeda|Silken|X2|Andromeda II|Halley|Flame|Saphyr 9,7|Touch 8|Planet|Triton|Unique 10|Hexen 10|Memphis 4GB|Memphis 8GB|Onix 10)",
        FX2Tablet: "FX2 PAD7|FX2 PAD10",
        XoroTablet:
          "KidsPAD 701|PAD[ ]?712|PAD[ ]?714|PAD[ ]?716|PAD[ ]?717|PAD[ ]?718|PAD[ ]?720|PAD[ ]?721|PAD[ ]?722|PAD[ ]?790|PAD[ ]?792|PAD[ ]?900|PAD[ ]?9715D|PAD[ ]?9716DR|PAD[ ]?9718DR|PAD[ ]?9719QR|PAD[ ]?9720QR|TelePAD1030|Telepad1032|TelePAD730|TelePAD731|TelePAD732|TelePAD735Q|TelePAD830|TelePAD9730|TelePAD795|MegaPAD 1331|MegaPAD 1851|MegaPAD 2151",
        ViewsonicTablet:
          "ViewPad 10pi|ViewPad 10e|ViewPad 10s|ViewPad E72|ViewPad7|ViewPad E100|ViewPad 7e|ViewSonic VB733|VB100a",
        OdysTablet:
          "LOOX|XENO10|ODYS[ -](Space|EVO|Xpress|NOON)|\\bXELIO\\b|Xelio10Pro|XELIO7PHONETAB|XELIO10EXTREME|XELIOPT2|NEO_QUAD10",
        CaptivaTablet: "CAPTIVA PAD",
        IconbitTablet:
          "NetTAB|NT-3702|NT-3702S|NT-3702S|NT-3603P|NT-3603P|NT-0704S|NT-0704S|NT-3805C|NT-3805C|NT-0806C|NT-0806C|NT-0909T|NT-0909T|NT-0907S|NT-0907S|NT-0902S|NT-0902S",
        TeclastTablet:
          "T98 4G|\\bP80\\b|\\bX90HD\\b|X98 Air|X98 Air 3G|\\bX89\\b|P80 3G|\\bX80h\\b|P98 Air|\\bX89HD\\b|P98 3G|\\bP90HD\\b|P89 3G|X98 3G|\\bP70h\\b|P79HD 3G|G18d 3G|\\bP79HD\\b|\\bP89s\\b|\\bA88\\b|\\bP10HD\\b|\\bP19HD\\b|G18 3G|\\bP78HD\\b|\\bA78\\b|\\bP75\\b|G17s 3G|G17h 3G|\\bP85t\\b|\\bP90\\b|\\bP11\\b|\\bP98t\\b|\\bP98HD\\b|\\bG18d\\b|\\bP85s\\b|\\bP11HD\\b|\\bP88s\\b|\\bA80HD\\b|\\bA80se\\b|\\bA10h\\b|\\bP89\\b|\\bP78s\\b|\\bG18\\b|\\bP85\\b|\\bA70h\\b|\\bA70\\b|\\bG17\\b|\\bP18\\b|\\bA80s\\b|\\bA11s\\b|\\bP88HD\\b|\\bA80h\\b|\\bP76s\\b|\\bP76h\\b|\\bP98\\b|\\bA10HD\\b|\\bP78\\b|\\bP88\\b|\\bA11\\b|\\bA10t\\b|\\bP76a\\b|\\bP76t\\b|\\bP76e\\b|\\bP85HD\\b|\\bP85a\\b|\\bP86\\b|\\bP75HD\\b|\\bP76v\\b|\\bA12\\b|\\bP75a\\b|\\bA15\\b|\\bP76Ti\\b|\\bP81HD\\b|\\bA10\\b|\\bT760VE\\b|\\bT720HD\\b|\\bP76\\b|\\bP73\\b|\\bP71\\b|\\bP72\\b|\\bT720SE\\b|\\bC520Ti\\b|\\bT760\\b|\\bT720VE\\b|T720-3GE|T720-WiFi",
        OndaTablet:
          "\\b(V975i|Vi30|VX530|V701|Vi60|V701s|Vi50|V801s|V719|Vx610w|VX610W|V819i|Vi10|VX580W|Vi10|V711s|V813|V811|V820w|V820|Vi20|V711|VI30W|V712|V891w|V972|V819w|V820w|Vi60|V820w|V711|V813s|V801|V819|V975s|V801|V819|V819|V818|V811|V712|V975m|V101w|V961w|V812|V818|V971|V971s|V919|V989|V116w|V102w|V973|Vi40)\\b[\\s]+",
        JaytechTablet: "TPC-PA762",
        BlaupunktTablet: "Endeavour 800NG|Endeavour 1010",
        DigmaTablet:
          "\\b(iDx10|iDx9|iDx8|iDx7|iDxD7|iDxD8|iDsQ8|iDsQ7|iDsQ8|iDsD10|iDnD7|3TS804H|iDsQ11|iDj7|iDs10)\\b",
        EvolioTablet:
          "ARIA_Mini_wifi|Aria[ _]Mini|Evolio X10|Evolio X7|Evolio X8|\\bEvotab\\b|\\bNeura\\b",
        LavaTablet: "QPAD E704|\\bIvoryS\\b|E-TAB IVORY|\\bE-TAB\\b",
        AocTablet: "MW0811|MW0812|MW0922|MTK8382",
        CelkonTablet:
          "CT695|CT888|CT[\\s]?910|CT7 Tab|CT9 Tab|CT3 Tab|CT2 Tab|CT1 Tab|C820|C720|\\bCT-1\\b",
        WolderTablet:
          "miTab \\b(DIAMOND|SPACE|BROOKLYN|NEO|FLY|MANHATTAN|FUNK|EVOLUTION|SKY|GOCAR|IRON|GENIUS|POP|MINT|EPSILON|BROADWAY|JUMP|HOP|LEGEND|NEW AGE|LINE|ADVANCE|FEEL|FOLLOW|LIKE|LINK|LIVE|THINK|FREEDOM|CHICAGO|CLEVELAND|BALTIMORE-GH|IOWA|BOSTON|SEATTLE|PHOENIX|DALLAS|IN 101|MasterChef)\\b",
        MiTablet: "\\bMI PAD\\b|\\bHM NOTE 1W\\b",
        NibiruTablet: "Nibiru M1|Nibiru Jupiter One",
        NexoTablet:
          "NEXO NOVA|NEXO 10|NEXO AVIO|NEXO FREE|NEXO GO|NEXO EVO|NEXO 3G|NEXO SMART|NEXO KIDDO|NEXO MOBI",
        LeaderTablet:
          "TBLT10Q|TBLT10I|TBL-10WDKB|TBL-10WDKBO2013|TBL-W230V2|TBL-W450|TBL-W500|SV572|TBLT7I|TBA-AC7-8G|TBLT79|TBL-8W16|TBL-10W32|TBL-10WKB|TBL-W100",
        UbislateTablet: "UbiSlate[\\s]?7C",
        PocketBookTablet: "Pocketbook",
        Hudl: "Hudl HT7S3|Hudl 2",
        TelstraTablet: "T-Hub2",
        GenericTablet:
          "Android.*\\b97D\\b|Tablet(?!.*PC)|BNTV250A|MID-WCDMA|LogicPD Zoom2|\\bA7EB\\b|CatNova8|A1_07|CT704|CT1002|\\bM721\\b|rk30sdk|\\bEVOTAB\\b|M758A|ET904|ALUMIUM10|Smartfren Tab|Endeavour 1010|Tablet-PC-4|Tagi Tab|\\bM6pro\\b|CT1020W|arc 10HD|\\bJolla\\b|\\bTP750\\b",
      },
      oss: {
        AndroidOS: "Android",
        BlackBerryOS: "blackberry|\\bBB10\\b|rim tablet os",
        PalmOS: "PalmOS|avantgo|blazer|elaine|hiptop|palm|plucker|xiino",
        SymbianOS: "Symbian|SymbOS|Series60|Series40|SYB-[0-9]+|\\bS60\\b",
        WindowsMobileOS:
          "Windows CE.*(PPC|Smartphone|Mobile|[0-9]{3}x[0-9]{3})|Window Mobile|Windows Phone [0-9.]+|WCE;",
        WindowsPhoneOS:
          "Windows Phone 10.0|Windows Phone 8.1|Windows Phone 8.0|Windows Phone OS|XBLWP7|ZuneWP7|Windows NT 6.[23]; ARM;",
        iOS: "\\biPhone.*Mobile|\\biPod|\\biPad",
        MeeGoOS: "MeeGo",
        MaemoOS: "Maemo",
        JavaOS: "J2ME/|\\bMIDP\\b|\\bCLDC\\b",
        webOS: "webOS|hpwOS",
        badaOS: "\\bBada\\b",
        BREWOS: "BREW",
      },
      uas: {
        Chrome: "\\bCrMo\\b|CriOS|Android.*Chrome/[.0-9]* (Mobile)?",
        Dolfin: "\\bDolfin\\b",
        Opera:
          "Opera.*Mini|Opera.*Mobi|Android.*Opera|Mobile.*OPR/[0-9.]+|Coast/[0-9.]+",
        Skyfire: "Skyfire",
        IE: "IEMobile|MSIEMobile",
        Firefox:
          "fennec|firefox.*maemo|(Mobile|Tablet).*Firefox|Firefox.*Mobile",
        Bolt: "bolt",
        TeaShark: "teashark",
        Blazer: "Blazer",
        Safari: "Version.*Mobile.*Safari|Safari.*Mobile|MobileSafari",
        Tizen: "Tizen",
        UCBrowser: "UC.*Browser|UCWEB",
        baiduboxapp: "baiduboxapp",
        baidubrowser: "baidubrowser",
        DiigoBrowser: "DiigoBrowser",
        Puffin: "Puffin",
        Mercury: "\\bMercury\\b",
        ObigoBrowser: "Obigo",
        NetFront: "NF-Browser",
        GenericBrowser:
          "NokiaBrowser|OviBrowser|OneBrowser|TwonkyBeamBrowser|SEMC.*Browser|FlyFlow|Minimo|NetFront|Novarra-Vision|MQQBrowser|MicroMessenger",
      },
      props: {
        Mobile: "Mobile/[VER]",
        Build: "Build/[VER]",
        Version: "Version/[VER]",
        VendorID: "VendorID/[VER]",
        iPad: "iPad.*CPU[a-z ]+[VER]",
        iPhone: "iPhone.*CPU[a-z ]+[VER]",
        iPod: "iPod.*CPU[a-z ]+[VER]",
        Kindle: "Kindle/[VER]",
        Chrome: ["Chrome/[VER]", "CriOS/[VER]", "CrMo/[VER]"],
        Coast: ["Coast/[VER]"],
        Dolfin: "Dolfin/[VER]",
        Firefox: "Firefox/[VER]",
        Fennec: "Fennec/[VER]",
        IE: [
          "IEMobile/[VER];",
          "IEMobile [VER]",
          "MSIE [VER];",
          "Trident/[0-9.]+;.*rv:[VER]",
        ],
        NetFront: "NetFront/[VER]",
        NokiaBrowser: "NokiaBrowser/[VER]",
        Opera: [" OPR/[VER]", "Opera Mini/[VER]", "Version/[VER]"],
        "Opera Mini": "Opera Mini/[VER]",
        "Opera Mobi": "Version/[VER]",
        "UC Browser": "UC Browser[VER]",
        MQQBrowser: "MQQBrowser/[VER]",
        MicroMessenger: "MicroMessenger/[VER]",
        baiduboxapp: "baiduboxapp/[VER]",
        baidubrowser: "baidubrowser/[VER]",
        Iron: "Iron/[VER]",
        Safari: ["Version/[VER]", "Safari/[VER]"],
        Skyfire: "Skyfire/[VER]",
        Tizen: "Tizen/[VER]",
        Webkit: "webkit[ /][VER]",
        Gecko: "Gecko/[VER]",
        Trident: "Trident/[VER]",
        Presto: "Presto/[VER]",
        iOS: " \\bi?OS\\b [VER][ ;]{1}",
        Android: "Android [VER]",
        BlackBerry: [
          "BlackBerry[\\w]+/[VER]",
          "BlackBerry.*Version/[VER]",
          "Version/[VER]",
        ],
        BREW: "BREW [VER]",
        Java: "Java/[VER]",
        "Windows Phone OS": ["Windows Phone OS [VER]", "Windows Phone [VER]"],
        "Windows Phone": "Windows Phone [VER]",
        "Windows CE": "Windows CE/[VER]",
        "Windows NT": "Windows NT [VER]",
        Symbian: ["SymbianOS/[VER]", "Symbian/[VER]"],
        webOS: ["webOS/[VER]", "hpwOS/[VER];"],
      },
      utils: {
        Bot:
          "Googlebot|facebookexternalhit|AdsBot-Google|Google Keyword Suggestion|Facebot|YandexBot|bingbot|ia_archiver|AhrefsBot|Ezooms|GSLFbot|WBSearchBot|Twitterbot|TweetmemeBot|Twikle|PaperLiBot|Wotbox|UnwindFetchor|Exabot|MJ12bot|YandexImages|TurnitinBot|Pingdom",
        MobileBot:
          "Googlebot-Mobile|AdsBot-Google-Mobile|YahooSeeker/M1A1-R2D2",
        DesktopMode: "WPDesktop",
        TV: "SonyDTV|HbbTV",
        WebKit: "(webkit)[ /]([\\w.]+)",
        Console: "\\b(Nintendo|Nintendo WiiU|Nintendo 3DS|PLAYSTATION|Xbox)\\b",
        Watch: "SM-V700",
      },
    };

    // following patterns come from http://detectmobilebrowsers.com/
    impl.detectMobileBrowsers = {
      fullPattern: /(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i,
      shortPattern: /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i,
      tabletPattern: /android|ipad|playbook|silk/i,
    };

    var hasOwnProp = Object.prototype.hasOwnProperty,
      isArray;

    impl.FALLBACK_PHONE = "UnknownPhone";
    impl.FALLBACK_TABLET = "UnknownTablet";
    impl.FALLBACK_MOBILE = "UnknownMobile";

    isArray =
      "isArray" in Array
        ? Array.isArray
        : function (value) {
            return Object.prototype.toString.call(value) === "[object Array]";
          };

    function equalIC(a, b) {
      return a != null && b != null && a.toLowerCase() === b.toLowerCase();
    }

    function containsIC(array, value) {
      var valueLC,
        i,
        len = array.length;
      if (!len || !value) {
        return false;
      }
      valueLC = value.toLowerCase();
      for (i = 0; i < len; ++i) {
        if (valueLC === array[i].toLowerCase()) {
          return true;
        }
      }
      return false;
    }

    function convertPropsToRegExp(object) {
      for (var key in object) {
        if (hasOwnProp.call(object, key)) {
          object[key] = new RegExp(object[key], "i");
        }
      }
    }

    (function init() {
      var key,
        values,
        value,
        i,
        len,
        verPos,
        mobileDetectRules = impl.mobileDetectRules;
      for (key in mobileDetectRules.props) {
        if (hasOwnProp.call(mobileDetectRules.props, key)) {
          values = mobileDetectRules.props[key];
          if (!isArray(values)) {
            values = [values];
          }
          len = values.length;
          for (i = 0; i < len; ++i) {
            value = values[i];
            verPos = value.indexOf("[VER]");
            if (verPos >= 0) {
              value =
                value.substring(0, verPos) +
                "([\\w._\\+]+)" +
                value.substring(verPos + 5);
            }
            values[i] = new RegExp(value, "i");
          }
          mobileDetectRules.props[key] = values;
        }
      }
      convertPropsToRegExp(mobileDetectRules.oss);
      convertPropsToRegExp(mobileDetectRules.phones);
      convertPropsToRegExp(mobileDetectRules.tablets);
      convertPropsToRegExp(mobileDetectRules.uas);
      convertPropsToRegExp(mobileDetectRules.utils);

      // copy some patterns to oss0 which are tested first (see issue#15)
      mobileDetectRules.oss0 = {
        WindowsPhoneOS: mobileDetectRules.oss.WindowsPhoneOS,
        WindowsMobileOS: mobileDetectRules.oss.WindowsMobileOS,
      };
    })();

    /**
     * Test userAgent string against a set of rules and find the first matched key.
     * @param {Object} rules (key is String, value is RegExp)
     * @param {String} userAgent the navigator.userAgent (or HTTP-Header 'User-Agent').
     * @returns {String|null} the matched key if found, otherwise <tt>null</tt>
     * @private
     */
    impl.findMatch = function (rules, userAgent) {
      for (var key in rules) {
        if (hasOwnProp.call(rules, key)) {
          if (rules[key].test(userAgent)) {
            return key;
          }
        }
      }
      return null;
    };

    /**
     * Test userAgent string against a set of rules and return an array of matched keys.
     * @param {Object} rules (key is String, value is RegExp)
     * @param {String} userAgent the navigator.userAgent (or HTTP-Header 'User-Agent').
     * @returns {Array} an array of matched keys, may be empty when there is no match, but not <tt>null</tt>
     * @private
     */
    impl.findMatches = function (rules, userAgent) {
      var result = [];
      for (var key in rules) {
        if (hasOwnProp.call(rules, key)) {
          if (rules[key].test(userAgent)) {
            result.push(key);
          }
        }
      }
      return result;
    };

    /**
     * Check the version of the given property in the User-Agent.
     *
     * @param {String} propertyName
     * @param {String} userAgent
     * @return {String} version or <tt>null</tt> if version not found
     * @private
     */
    impl.getVersionStr = function (propertyName, userAgent) {
      var props = impl.mobileDetectRules.props,
        patterns,
        i,
        len,
        match;
      if (hasOwnProp.call(props, propertyName)) {
        patterns = props[propertyName];
        len = patterns.length;
        for (i = 0; i < len; ++i) {
          match = patterns[i].exec(userAgent);
          if (match !== null) {
            return match[1];
          }
        }
      }
      return null;
    };

    /**
     * Check the version of the given property in the User-Agent.
     * Will return a float number. (eg. 2_0 will return 2.0, 4.3.1 will return 4.31)
     *
     * @param {String} propertyName
     * @param {String} userAgent
     * @return {Number} version or <tt>NaN</tt> if version not found
     * @private
     */
    impl.getVersion = function (propertyName, userAgent) {
      var version = impl.getVersionStr(propertyName, userAgent);
      return version ? impl.prepareVersionNo(version) : NaN;
    };

    /**
     * Prepare the version number.
     *
     * @param {String} version
     * @return {Number} the version number as a floating number
     * @private
     */
    impl.prepareVersionNo = function (version) {
      var numbers;

      numbers = version.split(/[a-z._ \/\-]/i);
      if (numbers.length === 1) {
        version = numbers[0];
      }
      if (numbers.length > 1) {
        version = numbers[0] + ".";
        numbers.shift();
        version += numbers.join("");
      }
      return Number(version);
    };

    impl.isMobileFallback = function (userAgent) {
      return (
        impl.detectMobileBrowsers.fullPattern.test(userAgent) ||
        impl.detectMobileBrowsers.shortPattern.test(userAgent.substr(0, 4))
      );
    };

    impl.isTabletFallback = function (userAgent) {
      return impl.detectMobileBrowsers.tabletPattern.test(userAgent);
    };

    impl.prepareDetectionCache = function (cache, userAgent, maxPhoneWidth) {
      if (cache.mobile !== undefined) {
        return;
      }
      var phone, tablet, phoneSized;

      // first check for stronger tablet rules, then phone (see issue#5)
      tablet = impl.findMatch(impl.mobileDetectRules.tablets, userAgent);
      if (tablet) {
        cache.mobile = cache.tablet = tablet;
        cache.phone = null;
        return; // unambiguously identified as tablet
      }

      phone = impl.findMatch(impl.mobileDetectRules.phones, userAgent);
      if (phone) {
        cache.mobile = cache.phone = phone;
        cache.tablet = null;
        return; // unambiguously identified as phone
      }

      // our rules haven't found a match -> try more general fallback rules
      if (impl.isMobileFallback(userAgent)) {
        phoneSized = MobileDetect.isPhoneSized(maxPhoneWidth);
        if (phoneSized === undefined) {
          cache.mobile = impl.FALLBACK_MOBILE;
          cache.tablet = cache.phone = null;
        } else if (phoneSized) {
          cache.mobile = cache.phone = impl.FALLBACK_PHONE;
          cache.tablet = null;
        } else {
          cache.mobile = cache.tablet = impl.FALLBACK_TABLET;
          cache.phone = null;
        }
      } else if (impl.isTabletFallback(userAgent)) {
        cache.mobile = cache.tablet = impl.FALLBACK_TABLET;
        cache.phone = null;
      } else {
        // not mobile at all!
        cache.mobile = cache.tablet = cache.phone = null;
      }
    };

    // t is a reference to a MobileDetect instance
    impl.mobileGrade = function (t) {
      // impl note:
      // To keep in sync w/ Mobile_Detect.php easily, the following code is tightly aligned to the PHP version.
      // When changes are made in Mobile_Detect.php, copy this method and replace:
      //     $this-> / t.
      //     self::MOBILE_GRADE_(.) / '$1'
      //     , self::VERSION_TYPE_FLOAT / (nothing)
      //     isIOS() / os('iOS')
      //     [reg] / (nothing)   <-- jsdelivr complaining about unescaped unicode character U+00AE
      var $isMobile = t.mobile() !== null;

      if (
        // Apple iOS 3.2-5.1 - Tested on the original iPad (4.3 / 5.0), iPad 2 (4.3), iPad 3 (5.1), original iPhone (3.1), iPhone 3 (3.2), 3GS (4.3), 4 (4.3 / 5.0), and 4S (5.1)
        (t.os("iOS") && t.version("iPad") >= 4.3) ||
        (t.os("iOS") && t.version("iPhone") >= 3.1) ||
        (t.os("iOS") && t.version("iPod") >= 3.1) ||
        // Android 2.1-2.3 - Tested on the HTC Incredible (2.2), original Droid (2.2), HTC Aria (2.1), Google Nexus S (2.3). Functional on 1.5 & 1.6 but performance may be sluggish, tested on Google G1 (1.5)
        // Android 3.1 (Honeycomb)  - Tested on the Samsung Galaxy Tab 10.1 and Motorola XOOM
        // Android 4.0 (ICS)  - Tested on a Galaxy Nexus. Note: transition performance can be poor on upgraded devices
        // Android 4.1 (Jelly Bean)  - Tested on a Galaxy Nexus and Galaxy 7
        (t.version("Android") > 2.1 && t.is("Webkit")) ||
        // Windows Phone 7-7.5 - Tested on the HTC Surround (7.0) HTC Trophy (7.5), LG-E900 (7.5), Nokia Lumia 800
        t.version("Windows Phone OS") >= 7.0 ||
        // Blackberry 7 - Tested on BlackBerry Torch 9810
        // Blackberry 6.0 - Tested on the Torch 9800 and Style 9670
        (t.is("BlackBerry") && t.version("BlackBerry") >= 6.0) ||
        // Blackberry Playbook (1.0-2.0) - Tested on PlayBook
        t.match("Playbook.*Tablet") ||
        // Palm WebOS (1.4-2.0) - Tested on the Palm Pixi (1.4), Pre (1.4), Pre 2 (2.0)
        (t.version("webOS") >= 1.4 && t.match("Palm|Pre|Pixi")) ||
        // Palm WebOS 3.0  - Tested on HP TouchPad
        t.match("hp.*TouchPad") ||
        // Firefox Mobile (12 Beta) - Tested on Android 2.3 device
        (t.is("Firefox") && t.version("Firefox") >= 12) ||
        // Chrome for Android - Tested on Android 4.0, 4.1 device
        (t.is("Chrome") && t.is("AndroidOS") && t.version("Android") >= 4.0) ||
        // Skyfire 4.1 - Tested on Android 2.3 device
        (t.is("Skyfire") &&
          t.version("Skyfire") >= 4.1 &&
          t.is("AndroidOS") &&
          t.version("Android") >= 2.3) ||
        // Opera Mobile 11.5-12: Tested on Android 2.3
        (t.is("Opera") && t.version("Opera Mobi") > 11 && t.is("AndroidOS")) ||
        // Meego 1.2 - Tested on Nokia 950 and N9
        t.is("MeeGoOS") ||
        // Tizen (pre-release) - Tested on early hardware
        t.is("Tizen") ||
        // Samsung Bada 2.0 - Tested on a Samsung Wave 3, Dolphin browser
        // @todo: more tests here!
        (t.is("Dolfin") && t.version("Bada") >= 2.0) ||
        // UC Browser - Tested on Android 2.3 device
        ((t.is("UC Browser") || t.is("Dolfin")) &&
          t.version("Android") >= 2.3) ||
        // Kindle 3 and Fire  - Tested on the built-in WebKit browser for each
        t.match("Kindle Fire") ||
        (t.is("Kindle") && t.version("Kindle") >= 3.0) ||
        // Nook Color 1.4.1 - Tested on original Nook Color, not Nook Tablet
        (t.is("AndroidOS") && t.is("NookTablet")) ||
        // Chrome Desktop 11-21 - Tested on OS X 10.7 and Windows 7
        (t.version("Chrome") >= 11 && !$isMobile) ||
        // Safari Desktop 4-5 - Tested on OS X 10.7 and Windows 7
        (t.version("Safari") >= 5.0 && !$isMobile) ||
        // Firefox Desktop 4-13 - Tested on OS X 10.7 and Windows 7
        (t.version("Firefox") >= 4.0 && !$isMobile) ||
        // Internet Explorer 7-9 - Tested on Windows XP, Vista and 7
        (t.version("MSIE") >= 7.0 && !$isMobile) ||
        // Opera Desktop 10-12 - Tested on OS X 10.7 and Windows 7
        // @reference: http://my.opera.com/community/openweb/idopera/
        (t.version("Opera") >= 10 && !$isMobile)
      ) {
        return "A";
      }

      if (
        (t.os("iOS") && t.version("iPad") < 4.3) ||
        (t.os("iOS") && t.version("iPhone") < 3.1) ||
        (t.os("iOS") && t.version("iPod") < 3.1) ||
        // Blackberry 5.0: Tested on the Storm 2 9550, Bold 9770
        (t.is("Blackberry") &&
          t.version("BlackBerry") >= 5 &&
          t.version("BlackBerry") < 6) ||
        //Opera Mini (5.0-6.5) - Tested on iOS 3.2/4.3 and Android 2.3
        (t.version("Opera Mini") >= 5.0 &&
          t.version("Opera Mini") <= 6.5 &&
          (t.version("Android") >= 2.3 || t.is("iOS"))) ||
        // Nokia Symbian^3 - Tested on Nokia N8 (Symbian^3), C7 (Symbian^3), also works on N97 (Symbian^1)
        t.match("NokiaN8|NokiaC7|N97.*Series60|Symbian/3") ||
        // @todo: report this (tested on Nokia N71)
        (t.version("Opera Mobi") >= 11 && t.is("SymbianOS"))
      ) {
        return "B";
      }

      if (
        // Blackberry 4.x - Tested on the Curve 8330
        t.version("BlackBerry") < 5.0 ||
        // Windows Mobile - Tested on the HTC Leo (WinMo 5.2)
        t.match("MSIEMobile|Windows CE.*Mobile") ||
        t.version("Windows Mobile") <= 5.2
      ) {
        return "C";
      }

      //All older smartphone platforms and featurephones - Any device that doesn't support media queries
      //will receive the basic, C grade experience.
      return "C";
    };

    impl.detectOS = function (ua) {
      return (
        impl.findMatch(impl.mobileDetectRules.oss0, ua) ||
        impl.findMatch(impl.mobileDetectRules.oss, ua)
      );
    };

    impl.getDeviceSmallerSide = function () {
      return window.screen.width < window.screen.height
        ? window.screen.width
        : window.screen.height;
    };

    /**
     * Constructor for MobileDetect object.
     * <br>
     * Such an object will keep a reference to the given user-agent string and cache most of the detect queries.<br>
     * <div style="background-color: #d9edf7; border: 1px solid #bce8f1; color: #3a87ad; padding: 14px; border-radius: 2px; margin-top: 20px">
     *     <strong>Find information how to download and install:</strong>
     *     <a href="https://github.com/hgoebl/mobile-detect.js/">github.com/hgoebl/mobile-detect.js/</a>
     * </div>
     *
     * @example <pre>
     *     var md = new MobileDetect(window.navigator.userAgent);
     *     if (md.mobile()) {
     *         location.href = (md.mobileGrade() === 'A') ? '/mobile/' : '/lynx/';
     *     }
     * </pre>
     *
     * @param {string} userAgent typically taken from window.navigator.userAgent or http_header['User-Agent']
     * @param {number} [maxPhoneWidth=600] <strong>only for browsers</strong> specify a value for the maximum
     *        width of smallest device side (in logical "CSS" pixels) until a device detected as mobile will be handled
     *        as phone.
     *        This is only used in cases where the device cannot be classified as phone or tablet.<br>
     *        See <a href="http://developer.android.com/guide/practices/screens_support.html">Declaring Tablet Layouts
     *        for Android</a>.<br>
     *        If you provide a value < 0, then this "fuzzy" check is disabled.
     * @constructor
     * @global
     */
    function MobileDetect(userAgent, maxPhoneWidth) {
      this.ua = userAgent || "";
      this._cache = {};
      //600dp is typical 7" tablet minimum width
      this.maxPhoneWidth = maxPhoneWidth || 600;
    }

    MobileDetect.prototype = {
      constructor: MobileDetect,

      /**
       * Returns the detected phone or tablet type or <tt>null</tt> if it is not a mobile device.
       * <br>
       * For a list of possible return values see {@link MobileDetect#phone} and {@link MobileDetect#tablet}.<br>
       * <br>
       * If the device is not detected by the regular expressions from Mobile-Detect, a test is made against
       * the patterns of <a href="http://detectmobilebrowsers.com/">detectmobilebrowsers.com</a>. If this test
       * is positive, a value of <code>UnknownPhone</code>, <code>UnknownTablet</code> or
       * <code>UnknownMobile</code> is returned.<br>
       * When used in browser, the decision whether phone or tablet is made based on <code>screen.width/height</code>.<br>
       * <br>
       * When used server-side (node.js), there is no way to tell the difference between <code>UnknownTablet</code>
       * and <code>UnknownMobile</code>, so you will get <code>UnknownMobile</code> here.<br>
       * Be aware that since v1.0.0 in this special case you will get <code>UnknownMobile</code> only for:
       * {@link MobileDetect#mobile}, not for {@link MobileDetect#phone} and {@link MobileDetect#tablet}.
       * In versions before v1.0.0 all 3 methods returned <code>UnknownMobile</code> which was tedious to use.
       * <br>
       * In most cases you will use the return value just as a boolean.
       *
       * @returns {String} the key for the phone family or tablet family, e.g. "Nexus".
       * @function MobileDetect#mobile
       */
      mobile: function () {
        impl.prepareDetectionCache(this._cache, this.ua, this.maxPhoneWidth);
        return this._cache.mobile;
      },

      /**
       * Returns the detected phone type/family string or <tt>null</tt>.
       * <br>
       * The returned tablet (family or producer) is one of following keys:<br>
       * <br><tt>iPhone, BlackBerry, HTC, Nexus, Dell, Motorola, Samsung, LG, Sony, Asus,
       * Micromax, Palm, Vertu, Pantech, Fly, Wiko, iMobile, SimValley, Wolfgang,
       * Alcatel, Nintendo, Amoi, INQ, GenericPhone</tt><br>
       * <br>
       * If the device is not detected by the regular expressions from Mobile-Detect, a test is made against
       * the patterns of <a href="http://detectmobilebrowsers.com/">detectmobilebrowsers.com</a>. If this test
       * is positive, a value of <code>UnknownPhone</code> or <code>UnknownMobile</code> is returned.<br>
       * When used in browser, the decision whether phone or tablet is made based on <code>screen.width/height</code>.<br>
       * <br>
       * When used server-side (node.js), there is no way to tell the difference between <code>UnknownTablet</code>
       * and <code>UnknownMobile</code>, so you will get <code>null</code> here, while {@link MobileDetect#mobile}
       * will return <code>UnknownMobile</code>.<br>
       * Be aware that since v1.0.0 in this special case you will get <code>UnknownMobile</code> only for:
       * {@link MobileDetect#mobile}, not for {@link MobileDetect#phone} and {@link MobileDetect#tablet}.
       * In versions before v1.0.0 all 3 methods returned <code>UnknownMobile</code> which was tedious to use.
       * <br>
       * In most cases you will use the return value just as a boolean.
       *
       * @returns {String} the key of the phone family or producer, e.g. "iPhone"
       * @function MobileDetect#phone
       */
      phone: function () {
        impl.prepareDetectionCache(this._cache, this.ua, this.maxPhoneWidth);
        return this._cache.phone;
      },

      /**
       * Returns the detected tablet type/family string or <tt>null</tt>.
       * <br>
       * The returned tablet (family or producer) is one of following keys:<br>
       * <br><tt>iPad, NexusTablet, SamsungTablet, Kindle, SurfaceTablet, HPTablet, AsusTablet,
       * BlackBerryTablet, HTCtablet, MotorolaTablet, NookTablet, AcerTablet,
       * ToshibaTablet, LGTablet, FujitsuTablet, PrestigioTablet, LenovoTablet,
       * DellTablet, YarvikTablet, MedionTablet, ArnovaTablet, IntensoTablet, IRUTablet,
       * MegafonTablet, EbodaTablet, AllViewTablet, ArchosTablet, AinolTablet,
       * SonyTablet, PhilipsTablet, CubeTablet, CobyTablet, MIDTablet, MSITablet,
       * SMiTTablet, RockChipTablet, FlyTablet, bqTablet, HuaweiTablet, NecTablet,
       * PantechTablet, BronchoTablet, VersusTablet, ZyncTablet, PositivoTablet,
       * NabiTablet, KoboTablet, DanewTablet, TexetTablet, PlaystationTablet,
       * TrekstorTablet, PyleAudioTablet, AdvanTablet, DanyTechTablet, GalapadTablet,
       * MicromaxTablet, KarbonnTablet, AllFineTablet, PROSCANTablet, YONESTablet,
       * ChangJiaTablet, GUTablet, PointOfViewTablet, OvermaxTablet, HCLTablet,
       * DPSTablet, VistureTablet, CrestaTablet, MediatekTablet, ConcordeTablet,
       * GoCleverTablet, ModecomTablet, VoninoTablet, ECSTablet, StorexTablet,
       * VodafoneTablet, EssentielBTablet, RossMoorTablet, iMobileTablet, TolinoTablet,
       * AudioSonicTablet, AMPETablet, SkkTablet, TecnoTablet, JXDTablet, iJoyTablet,
       * FX2Tablet, XoroTablet, ViewsonicTablet, OdysTablet, CaptivaTablet,
       * IconbitTablet, TeclastTablet, OndaTablet, JaytechTablet, BlaupunktTablet,
       * DigmaTablet, EvolioTablet, LavaTablet, AocTablet, CelkonTablet, WolderTablet,
       * MiTablet, NibiruTablet, NexoTablet, LeaderTablet, UbislateTablet,
       * PocketBookTablet, Hudl, TelstraTablet, GenericTablet</tt><br>
       * <br>
       * If the device is not detected by the regular expressions from Mobile-Detect, a test is made against
       * the patterns of <a href="http://detectmobilebrowsers.com/">detectmobilebrowsers.com</a>. If this test
       * is positive, a value of <code>UnknownTablet</code> or <code>UnknownMobile</code> is returned.<br>
       * When used in browser, the decision whether phone or tablet is made based on <code>screen.width/height</code>.<br>
       * <br>
       * When used server-side (node.js), there is no way to tell the difference between <code>UnknownTablet</code>
       * and <code>UnknownMobile</code>, so you will get <code>null</code> here, while {@link MobileDetect#mobile}
       * will return <code>UnknownMobile</code>.<br>
       * Be aware that since v1.0.0 in this special case you will get <code>UnknownMobile</code> only for:
       * {@link MobileDetect#mobile}, not for {@link MobileDetect#phone} and {@link MobileDetect#tablet}.
       * In versions before v1.0.0 all 3 methods returned <code>UnknownMobile</code> which was tedious to use.
       * <br>
       * In most cases you will use the return value just as a boolean.
       *
       * @returns {String} the key of the tablet family or producer, e.g. "SamsungTablet"
       * @function MobileDetect#tablet
       */
      tablet: function () {
        impl.prepareDetectionCache(this._cache, this.ua, this.maxPhoneWidth);
        return this._cache.tablet;
      },

      /**
       * Returns the (first) detected user-agent string or <tt>null</tt>.
       * <br>
       * The returned user-agent is one of following keys:<br>
       * <br><tt>Chrome, Dolfin, Opera, Skyfire, IE, Firefox, Bolt, TeaShark, Blazer, Safari,
       * Tizen, UCBrowser, baiduboxapp, baidubrowser, DiigoBrowser, Puffin, Mercury,
       * ObigoBrowser, NetFront, GenericBrowser</tt><br>
       * <br>
       * In most cases calling {@link MobileDetect#userAgent} will be sufficient. But there are rare
       * cases where a mobile device pretends to be more than one particular browser. You can get the
       * list of all matches with {@link MobileDetect#userAgents} or check for a particular value by
       * providing one of the defined keys as first argument to {@link MobileDetect#is}.
       *
       * @returns {String} the key for the detected user-agent or <tt>null</tt>
       * @function MobileDetect#userAgent
       */
      userAgent: function () {
        if (this._cache.userAgent === undefined) {
          this._cache.userAgent = impl.findMatch(
            impl.mobileDetectRules.uas,
            this.ua
          );
        }
        return this._cache.userAgent;
      },

      /**
       * Returns all detected user-agent strings.
       * <br>
       * The array is empty or contains one or more of following keys:<br>
       * <br><tt>Chrome, Dolfin, Opera, Skyfire, IE, Firefox, Bolt, TeaShark, Blazer, Safari,
       * Tizen, UCBrowser, baiduboxapp, baidubrowser, DiigoBrowser, Puffin, Mercury,
       * ObigoBrowser, NetFront, GenericBrowser</tt><br>
       * <br>
       * In most cases calling {@link MobileDetect#userAgent} will be sufficient. But there are rare
       * cases where a mobile device pretends to be more than one particular browser. You can get the
       * list of all matches with {@link MobileDetect#userAgents} or check for a particular value by
       * providing one of the defined keys as first argument to {@link MobileDetect#is}.
       *
       * @returns {Array} the array of detected user-agent keys or <tt>[]</tt>
       * @function MobileDetect#userAgents
       */
      userAgents: function () {
        if (this._cache.userAgents === undefined) {
          this._cache.userAgents = impl.findMatches(
            impl.mobileDetectRules.uas,
            this.ua
          );
        }
        return this._cache.userAgents;
      },

      /**
       * Returns the detected operating system string or <tt>null</tt>.
       * <br>
       * The operating system is one of following keys:<br>
       * <br><tt>AndroidOS, BlackBerryOS, PalmOS, SymbianOS, WindowsMobileOS, WindowsPhoneOS,
       * iOS, MeeGoOS, MaemoOS, JavaOS, webOS, badaOS, BREWOS</tt><br>
       *
       * @returns {String} the key for the detected operating system.
       * @function MobileDetect#os
       */
      os: function () {
        if (this._cache.os === undefined) {
          this._cache.os = impl.detectOS(this.ua);
        }
        return this._cache.os;
      },

      /**
       * Get the version (as Number) of the given property in the User-Agent.
       * <br>
       * Will return a float number. (eg. 2_0 will return 2.0, 4.3.1 will return 4.31)
       *
       * @param {String} key a key defining a thing which has a version.<br>
       *        You can use one of following keys:<br>
       * <br><tt>Mobile, Build, Version, VendorID, iPad, iPhone, iPod, Kindle, Chrome, Coast,
       * Dolfin, Firefox, Fennec, IE, NetFront, NokiaBrowser, Opera, Opera Mini, Opera
       * Mobi, UC Browser, MQQBrowser, MicroMessenger, baiduboxapp, baidubrowser, Iron,
       * Safari, Skyfire, Tizen, Webkit, Gecko, Trident, Presto, iOS, Android,
       * BlackBerry, BREW, Java, Windows Phone OS, Windows Phone, Windows CE, Windows
       * NT, Symbian, webOS</tt><br>
       *
       * @returns {Number} the version as float or <tt>NaN</tt> if User-Agent doesn't contain this version.
       *          Be careful when comparing this value with '==' operator!
       * @function MobileDetect#version
       */
      version: function (key) {
        return impl.getVersion(key, this.ua);
      },

      /**
       * Get the version (as String) of the given property in the User-Agent.
       * <br>
       *
       * @param {String} key a key defining a thing which has a version.<br>
       *        You can use one of following keys:<br>
       * <br><tt>Mobile, Build, Version, VendorID, iPad, iPhone, iPod, Kindle, Chrome, Coast,
       * Dolfin, Firefox, Fennec, IE, NetFront, NokiaBrowser, Opera, Opera Mini, Opera
       * Mobi, UC Browser, MQQBrowser, MicroMessenger, baiduboxapp, baidubrowser, Iron,
       * Safari, Skyfire, Tizen, Webkit, Gecko, Trident, Presto, iOS, Android,
       * BlackBerry, BREW, Java, Windows Phone OS, Windows Phone, Windows CE, Windows
       * NT, Symbian, webOS</tt><br>
       *
       * @returns {String} the "raw" version as String or <tt>null</tt> if User-Agent doesn't contain this version.
       *
       * @function MobileDetect#versionStr
       */
      versionStr: function (key) {
        return impl.getVersionStr(key, this.ua);
      },

      /**
       * Global test key against userAgent, os, phone, tablet and some other properties of userAgent string.
       *
       * @param {String} key the key (case-insensitive) of a userAgent, an operating system, phone or
       *        tablet family.<br>
       *        For a complete list of possible values, see {@link MobileDetect#userAgent},
       *        {@link MobileDetect#os}, {@link MobileDetect#phone}, {@link MobileDetect#tablet}.<br>
       *        Additionally you have following keys:<br>
       * <br><tt>Bot, MobileBot, DesktopMode, TV, WebKit, Console, Watch</tt><br>
       *
       * @returns {boolean} <tt>true</tt> when the given key is one of the defined keys of userAgent, os, phone,
       *                    tablet or one of the listed additional keys, otherwise <tt>false</tt>
       * @function MobileDetect#is
       */
      is: function (key) {
        return (
          containsIC(this.userAgents(), key) ||
          equalIC(key, this.os()) ||
          equalIC(key, this.phone()) ||
          equalIC(key, this.tablet()) ||
          containsIC(
            impl.findMatches(impl.mobileDetectRules.utils, this.ua),
            key
          )
        );
      },

      /**
       * Do a quick test against navigator::userAgent.
       *
       * @param {String|RegExp} pattern the pattern, either as String or RegExp
       *                        (a string will be converted to a case-insensitive RegExp).
       * @returns {boolean} <tt>true</tt> when the pattern matches, otherwise <tt>false</tt>
       * @function MobileDetect#match
       */
      match: function (pattern) {
        if (!(pattern instanceof RegExp)) {
          pattern = new RegExp(pattern, "i");
        }
        return pattern.test(this.ua);
      },

      /**
       * Checks whether the mobile device can be considered as phone regarding <code>screen.width</code>.
       * <br>
       * Obviously this method makes sense in browser environments only (not for Node.js)!
       * @param {number} [maxPhoneWidth] the maximum logical pixels (aka. CSS-pixels) to be considered as phone.<br>
       *        The argument is optional and if not present or falsy, the value of the constructor is taken.
       * @returns {boolean|undefined} <code>undefined</code> if screen size wasn't detectable, else <code>true</code>
       *          when screen.width is less or equal to maxPhoneWidth, otherwise <code>false</code>.<br>
       *          Will always return <code>undefined</code> server-side.
       */
      isPhoneSized: function (maxPhoneWidth) {
        return MobileDetect.isPhoneSized(maxPhoneWidth || this.maxPhoneWidth);
      },

      /**
       * Returns the mobile grade ('A', 'B', 'C').
       *
       * @returns {String} one of the mobile grades ('A', 'B', 'C').
       * @function MobileDetect#mobileGrade
       */
      mobileGrade: function () {
        if (this._cache.grade === undefined) {
          this._cache.grade = impl.mobileGrade(this);
        }
        return this._cache.grade;
      },
    };

    // environment-dependent
    if (typeof window !== "undefined" && window.screen) {
      MobileDetect.isPhoneSized = function (maxPhoneWidth) {
        return maxPhoneWidth < 0
          ? undefined
          : impl.getDeviceSmallerSide() <= maxPhoneWidth;
      };
    } else {
      MobileDetect.isPhoneSized = function () {};
    }

    // should not be replaced by a completely new object - just overwrite existing methods
    MobileDetect._impl = impl;

    return MobileDetect;
  }); // end of call of define()
})(
  (function (undefined) {
    if (typeof module !== "undefined" && module.exports) {
      return function (factory) {
        module.exports = factory();
      };
    } else if (typeof define === "function" && define.amd) {
      return define;
    } else if (typeof window !== "undefined") {
      return function (factory) {
        window.MobileDetect = factory();
      };
    } else {
      // please file a bug if you get this error!
      throw new Error("unknown environment");
    }
  })()
);

initializeCanvasContent();

function initializeCanvasContent() {
  /*jslint browser: true*/
  (function ($) {
    $.stringRandom = {
      generate: function (length) {
        length = length ? length : 5;
        var text = "";
        var possible =
          "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        for (var i = 0; i <= length; i++) {
          text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
      },
    };
  })(jQuery);

  /*jslint browser: true*/
  (function ($) {
    $.formInputs = {
      submit: function () {
        // prevent submitting forms on enter key...
        $(document).on("keypress", "input", function (event) {
          if (
            event.keyCode == 13 &&
            $(this).parents("form").attr("id") !== "loginForm" &&
            !$(this).parents("form").hasClass("submit-on-change")
          ) {
            event.preventDefault();
            return false;
          }
        });
        $("form.submit-on-change").on("change", "select", function (event) {
          $(this).parents("form").submit();
        });
      },
      init: function () {
        $(".select-wrapper").on("DOMNodeInserted", function () {
          if (!$(this).children("span").length) {
            $(this).prepend(
              "<span>" +
                $(this).find("select option:selected").text() +
                "</span>"
            );
          }
        });

        $(document)
          .on("change", ".select:not([readonly])", function () {
            $(this)
              .prev()
              .replaceWith(
                "<span>" + $(this).find("option:selected").text() + "</span>"
              );
          })
          .on("focus", ".select:not([readonly])", function () {
            $(this).parent().addClass("focus");
          })
          .on("blur", ".select:not([readonly])", function () {
            $(this).parent().removeClass("focus");
          });

        $(".checkbox").on("DOMNodeInserted", function () {
          if ($(this).is(":checked")) {
            $(this).parents(".checkbox-wrapper").addClass("checked");
          }
        });

        $(document).on("change", ".checkbox:not([readonly])", function () {
          var checkbox = $(this);

          var wrapper = $(this).parents(".checkbox-wrapper");
          if (checkbox.is(":checked")) {
            wrapper.addClass("checked").removeClass("validation_failed");
            if ($(this).attr("id") == "include_session_part") {
              var selected_session_part = $("#selected_session_part").val();
            }
          } else if (checkbox.not(":checked")) {
            wrapper.removeClass("checked");
          }
        });

        $(".radio").on("DOMNodeInserted", function () {
          if ($(this).is(":checked")) {
            $(this).parents(".radio-wrapper").addClass("checked");
          }
        });

        $(document).on("change", ".radio:not([readonly])", function () {
          var radio = $(this);
          var wrapper = $(this).parents(".radio-wrapper");
          var container = wrapper.parents(".field-wrapper");

          container.find(".radio-wrapper").removeClass("checked");
          if (radio.is(":checked")) {
            wrapper.addClass("checked").removeClass("validation_failed");
          }
        });
      },
      restrictParams: function ($form) {
        $form.find("input, textarea, select", this).each(function () {
          if ($(this).val() === "" || $(this).val() === null) {
            $(this).removeAttr("name");
          }
        });
        //return false;
      },
    };

    $(function () {
      $.formInputs.init();
      $.formInputs.submit();
    });
  })(jQuery);

  /*jslint browser: true*/
  (function ($) {
    $.formAutosize = {
      init: function () {
        autosize($(".autosize")).on("autosize:resized", function () {
          $(window).resize();
        });
      },
      refresh: function () {
        $(".autosize").each(function () {
          autosize.update(this);
        });
      },
    };

    $(function () {
      $.formAutosize.init();
    });
  })(jQuery);

  (function ($) {
    // Ok lets go...
    $.dialog = {
      show: function (opts) {
        delete this.callback;
        delete this.callbackParams;

        if (opts && opts.type && !$("#dialog-overlay").length) {
          if (opts.callback) {
            this.callback = opts.callback;
          }
          if (opts.callbackParams) {
            this.callbackParams = opts.callbackParams;
          }
          var html = "";
          if (opts.cancelText == "OK" || opts.cancelText == "GOT IT") {
            html += '<div id="dialog-wrap-parent">';
          }
          var opt_title = opts.title;
          if (opt_title.indexOf("export") > 0) {
            html += '<div id="dialog-wrap-parent-export">';
          }
          html += '<div id="dialog-wrap">';
          html += '<div id="dialog-overlay">';

          if (opts.popup_type == "right-click") {
            var right_click_popup = "right_click_note";
          } else {
            var right_click_popup = "";
          }
          html += '<div id="dialog" class=' + right_click_popup + ">";
          html += '<div class="dialog-inner">';

          if (opts.type === "prompt" || opts.actionText == "Save As .TT") {
            html +=
              '<form action="" id="session_information" onsubmit="$.dialog.hide();return false;">';
          }

          html += '<div class="dialog-content">';
          html += '<div class="dialog-title">' + opts.title + "</div>";
          if (opts.description) {
            html += "<p>" + this.nativeConvert(opts.description) + "</p>";
            if (opts.actionText == "Save As .TT") {
              html +=
                '<div>session Name<input name="session_name" type="text"/></div>';
            }
          }
          if (opts.type === "prompt") {
            html += '<input class="field full" id="prompt_value" value="" />';
          }
          html += "</div>";

          $submitting = "";
          if (opts.actionTextSubmitting) {
            $submitting = 'data-submitting="' + opts.actionTextSubmitting + '"';
          }
          $submittingAlt = "";
          if (opts.actionAltTextSubmitting) {
            $submittingAlt =
              'data-submitting="' + opts.actionAltTextSubmitting + '"';
          }

          var cancelText = opts.cancelText ? opts.cancelText : "CANCEL";

          if (typeof this.callback === "function") {
            var altClass =
              opts.actionText && opts.actionAltText
                ? "multiple-actions x3"
                : "multiple-actions ";
            html += '<div class="dialog-actions ' + altClass + '">';
            html +=
              '<a href="javascript:;" class="dialog-cancel" >' +
              cancelText +
              "</a>";
            if (opts.actionAltText) {
              html +=
                '<a href="javascript:;" ' +
                $submittingAlt +
                ' class="dialog-action-alt" onclick="jQuery.dialog.hide(this); return false;">' +
                opts.actionAltText +
                "</a>";
            }
            if (opts.actionText) {
              html +=
                '<a href="javascript:;" ' +
                $submitting +
                ' class="dialog-action">' +
                opts.actionText +
                "</a>";
            }
            html += "</div>";
            if (opts.popup_type == "session_history") {
              html +=
                '<p class="session_histry"><sup>*</sup> Note: Delete Internet history for better performance</p>';
            }
          } else {
            var cancel = opts.type === "alert" ? "OK" : cancelText;
            html += '<div class="dialog-actions">';
            html +=
              '<a href="javascript:;" class="hide-print">' + cancel + "</a>";
            html += "</div>";
            if (opts.popup_type == "right-click") {
              html +=
                '<p class="session_histry"><sup>*</sup> Note: Use Long Hold for Tablet Devices i.e. Ipad</p>';
            }
          }

          if (opts.type === "prompt" || opts.actionText == "Save As .TT") {
            html += "</form>";
          }

          html += "</div>";
          html += "</div>";
          html += "</div>";
          html += "</div>";
          if (opts.cancelText == "ok") {
            html += "</div>";
          }
          if (opt_title.indexOf("export") > 0) {
            html += "</div>";
          }

          $("body").append(html);

          jQuery(".dialog-action").on("click touchstart", function (e) {
            e.stopPropagation();
            e.preventDefault();
            jQuery.dialog.hide(this, "", opts.callback);
            return false;
          });
          jQuery(".hide-print").on("click touchstart", function (e) {
            jQuery.dialog.hide(this, true);
            return false;
          });

          jQuery(".dialog-cancel").on("click touchstart", function (e) {
            e.stopPropagation();
            e.preventDefault();
            $("img.loader-img").css("display", "none"); //a?
            jQuery.dialog.hide(this, true, opts.callback);
            $(this).parent(".dialog-inner").find(".dialog-title").text();
            if ($(this).parents("#dialog-wrap-parent-export").length) {
              $(".export_session_container").hide();
            }
            return false;
          });

          if (opts.openCallback && typeof opts.openCallback === "function") {
            // use event to track which btn was pressed and add to params
            if (opts.openCallbackParams) {
              opts.openCallback(opts.openCallbackParams);
            } else {
              opts.openCallback();
            }
          }

          $("#dialog-wrap")
            .hide()
            .fadeIn("fast", function () {
              $("#dialog").addClass("visible");
            });

          $(document).on("keydown", this.keyboard);
        }
      },
      hide: function (event, cancelCallback, callback) {
        $(document).off("keydown", this.keyboard);
        if (
          typeof this.callback == "undefined" &&
          typeof callback == "function"
        ) {
          this.callback = callback;
        }
        if (typeof this.callback === "function" && !cancelCallback) {
          if (this.callbackParams) {
            this.callback(this.callbackParams, event);
          } else {
            this.callback(event);
          }
        }
        $("#dialog").removeClass("visible");
        $("#dialog-wrap").fadeOut("fast", function () {
          $(this).remove();
          $("#dialog").remove();
        });
      },
      keyboard: function (event) {
        if (event.keyCode == 13) {
          // Enter pressed...
          $.dialog.hide();
        }
        if (event.keyCode == 27) {
          // Escape pressed...
          $.dialog.hide(true);
        }
      },
      nativeConvert: function (str, is_xhtml) {
        var breakTag =
          is_xhtml || typeof is_xhtml === "undefined" ? "<br />" : "<br>";
        return (str + "").replace(
          /([^>\r\n]?)(\r\n|\n\r|\r|\n)/g,
          "$1" + breakTag + "$2"
        );
      },
      alert: function (opts) {
        //shortcut....
        opts.type = "alert";
        this.show(opts);
      },
      confirm: function (opts, popup_type) {
        //shortcut....
        if (popup_type == undefined) {
          popup_type = "";
        }
        opts.type = "confirm";
        opts.popup_type = popup_type;
        this.show(opts);
      },
      prompt: function (opts) {
        //shortcut....
        opts.type = "prompt";
        this.show(opts);
      },
    };
  })(jQuery);
  (function ($) {
    // Ok lets go...
    $.modal = {
      show: function (opts, focus) {
        focus = focus ? focus : false;

        delete this.callback;
        delete this.cancelCallback;
        delete this.callbackParams;
        delete this.remainOpen;

        if (opts && !$("#modal-wrap").length) {
          if (opts.callback) {
            this.callback = opts.callback;
          }
          if (opts.callbackParams) {
            this.callbackParams = opts.callbackParams;
          }
          if (
            opts.cancelCallback &&
            typeof opts.cancelCallback === "function"
          ) {
            this.cancelCallback = opts.cancelCallback;
          }
          if (opts.remainOpen) {
            this.remainOpen = true;
          }

          var html = "";

          html += '<div id="modal-wrap">';
          html += '<div id="modal-overlay">';
          if (opts.callback) {
            html +=
              '<form class="modal" id="modal" action="" method="POST" onsubmit="$.modal.hide($(this).find(\'button[type=submit]:focus\'));return false;">';
          } else {
            if (!opts.formAction) {
              opts.formAction = "";
            }
            this.remainOpen = true;
            html +=
              '<form class="modal" id="modal" action="' +
              opts.formAction +
              '" method="POST" onsubmit="$.modal.hide($(this).find(\'button[type=submit]:focus\'));">';
          }
          html += '<div class="modal-inner">';
          html += '<div class="modal-header">';
          html += '<div class="modal-title">' + opts.title + "</div>";
          html += "</div>";
          if (opts.search == true) {
            html += '<div class="modal-search">';
            html +=
              '<div class="loading"><i class="fa fa-spinner fa-spin"></i></div>';
            html += '<input type="search" placeholder="Search">';
            html += "</div>";
          }
          html += '<div class="modal-content">';
          if (!opts.ajax && opts.content) {
            html += opts.content;
          }
          html += "</div>";

          $submitting = "";
          if (opts.actionTextSubmitting) {
            $submitting = 'data-submitting="' + opts.actionTextSubmitting + '"';
          }
          $submittingAlt = "";
          if (opts.actionAltTextSubmitting) {
            $submittingAlt =
              'data-submitting="' + opts.actionAltTextSubmitting + '"';
          }

          var cancelText = opts.cancelText ? opts.cancelText : "CANCEL";
          if (opts.actionText) {
            var altClass = opts.actionAltText
              ? "multiple-actions x3"
              : "multiple-actions ";
            html += '<div class="modal-actions ' + altClass + '">';
            html +=
              '<button onclick="jQuery.modal.hide(jQuery(this),true,true); return false;" class="modal-cancel">' +
              cancelText +
              "</button>";
            if (opts.actionAltText) {
              html +=
                '<button type="submit" ' +
                $submittingAlt +
                ' class="modal-action-alt">' +
                opts.actionAltText +
                "</button>";
            }
            html +=
              '<button type="submit" ' +
              $submitting +
              ' class="modal-action">' +
              opts.actionText +
              "</button>";
            html += "</div>";
          } else {
            html += '<div class="modal-actions">';
            html +=
              '<button onclick="jQuery.modal.hide(jQuery(this),true,true); return false;" class="modal-cancel">' +
              cancelText +
              "</button>";
            html += "</div>";
          }
          html += "</div>";
          html += "</form>";
          html += "</div>";
          html += "</div>";

          $("body").append(html);
          if (opts.openCallback && typeof opts.openCallback === "function") {
            // use event to track which btn was pressed and add to params
            if (opts.openCallbackParams) {
              opts.openCallback(opts.openCallbackParams);
            } else {
              opts.openCallback();
            }
          }

          $("#modal-wrap")
            .hide()
            .fadeIn("fast", function () {
              if (opts.ajax) {
                $("#modal .modal-content").load(
                  opts.ajax,
                  function (response, status, xhr) {
                    if (status == "error") {
                      $.dialog.alert({ title: "Unable to load view" });
                      $.modal.hide(true);
                    } else {
                      $("#modal").addClass("visible");
                    }
                  }
                );
              } else {
                $("#modal").addClass("visible");
              }
            });
        }
      },
      hide: function ($clickObj, cancelCallback, forceClose, remainOpen) {
        if ($("#modal").hasClass("submitting")) {
          return;
        }

        if (
          typeof this.cancelCallback === "function" &&
          $clickObj.hasClass("modal-cancel")
        ) {
          this.cancelCallback($clickObj);
        }

        if (typeof this.callback === "function" && !cancelCallback) {
          // use event to track which btn was pressed and add to params
          if (this.callbackParams) {
            this.callback(this.callbackParams, $clickObj);
          } else {
            this.callback($clickObj);
          }
        }

        if ((this.remainOpen || remainOpen) && !forceClose) {
          return;
        }

        $("#modal").removeClass("visible");
        $("#modal-wrap").fadeOut("fast", function () {
          $(this).remove();
          $("#modal").remove();
        });
      },
    };
  })(jQuery);
  /*jslint browser: true*/
  /*global error,success*/
  (function ($) {
    $.notify = {
      ajaxMessageWrap: null,
      init: function () {
        this.ajaxMessageWrap = $("#ajaxMessage");
        if (!this.ajaxMessageWrap.length) {
          $("body").prepend('<div id="ajaxMessage"></div>');
          /*
                this.ajaxMessageWrap = $('#ajaxMessage').click(function () {
                    $.notify.hideAjaxMessages();
                });
*/
        }
        $("#ajaxMessage")
          .off()
          .on("click", ".close_btn", function () {
            $.notify.hideAjaxMessages();
            return false;
          });
        this.ajaxMessageStartup();
      },
      ajaxMessageStartup: function () {
        if (typeof error !== "undefined" && error !== null) {
          $.notify.ajaxMessage("error", error);
        }
        if (typeof success !== "undefined" && success !== null) {
          $.notify.ajaxMessage("success", success);
        }
      },
      ajaxMessage: function (type, message) {
        if (type === "processing") {
          this.hideAjaxMessages();
        } else if (type !== "processing") {
          $(".ajaxMessage").fadeOut(function () {
            $(this).remove();
          });
        }
        clearTimeout(this.ajaxMessageWrapTimeout);

        var $icons = {
            info: '<i class="fa fa-info-circle"></i>',
            success: '<i class="fa fa-check"></i>',
            error: '<i class="fa fa-exclamation-triangle"></i>',
            processing: '<i class="fa fa-circle-o-notch fa-spin"></i>',
          },
          $output = $(
            '<div class="ajaxMessage ' +
              type +
              '"><span class="message">' +
              $icons[type] +
              " " +
              message +
              '</span><a href="javascript:void(0);" class="close_btn"></a></div>'
          );
        $output.prependTo(this.ajaxMessageWrap).fadeIn();
        this.ajaxMessageWrapTimeout = setTimeout(function () {
          $(".ajaxMessage.success").fadeOut(function () {
            $(this).remove();
          });
        }, 3000);
      },
      hideAjaxMessages: function () {
        var animation = "fadeOut";
        if (animation === "fadeOut") {
          $(".ajaxMessage").fadeOut(function () {
            $(this).remove();
          });
        } else if (animation === "hide") {
          $(this).remove();
        }
      },
    };

    $(function () {
      $.notify.init();
    });
  })(jQuery);

  /*jslint browser: true*/
  /*global plupload*/
  (function ($) {
    $.uploads = {
      init: function () {
        // Init File Uplaods
        var $uploads = $(".upload");
        if ($uploads.length <= 0) {
          return;
        }

        $uploads.each(function () {
          $.uploads.setup($(this));
        });

        // add events to show full image here...
      },
      setup: function ($this) {
        var element = $this.attr("id"),
          opts = $.parseJSON($this.attr("params"));

        if ($this[0].uploader) {
          $this[0].uploader.refresh();
          return;
        }

        $this[0].uploader = new plupload.Uploader({
          runtimes: "html5,html4",
          browse_button: opts.object + "-browse",
          drop_element: opts.object + "-drop",
          max_file_size: opts.maxFilesize,
          url: params.baseURL + "/" + params.appSlug + "/media/upload",
          multi_selection: false,
          multipart_params: {
            _token: params._token,
            object_type: opts.object_type,
            object_id: opts.object_id,
          },
          filters: [{ title: "Files", extensions: opts.filetypes }],
          resize: {
            width: 1000,
            height: 1000,
            crop: false,
            quality: 80,
          },
        });

        $this[0].uploader.bind("Init", function (up) {
          //Get images previously uploaded
          $("#" + opts.object + "-rows .uploaded .file").each(function () {
            var file = {};
            file.id = $(this).attr("id");
            file.name = $(this).find(".filename").text();
            up.files.push(file);
          });
        });
        $this[0].uploader.init();

        $this[0].uploader.bind("Error", function (up, err) {
          $.dialog.alert({
            title: "Upload Error!",
            description: err.message,
          });
          // Remove the file...
          up.removeFile(err.file);
        });

        var uploading = 0;
        $this[0].uploader.bind("FilesAdded", function (up, files) {
          if (up.files.length > opts.limit && opts.limit !== "-1") {
            $.each(files, function (i, file) {
              up.removeFile(file);
            });
            $.dialog.alert({
              title: "Uploader Error.",
              description:
                "You're only allowed to add a maximum of " +
                opts.limit +
                " file(s).",
            });
          } else {
            $("#item-row-no-results-" + opts.object).hide();
            $.each(files, function (i, file) {
              $html = $.itemRows.render(
                $("#" + opts.object + "-progress-template").html(),
                file
              );
              if (
                $("#" + opts.object + "-rows").find("tbody tr:visible ").length
              ) {
                $("#" + opts.object + "-rows")
                  .find("tbody tr:visible:last")
                  .after($html);
              } else {
                $("#" + opts.object + "-rows")
                  .find("tbody")
                  .prepend($html);
              }
            });

            $this[0].uploader.start();
          }
          up.refresh();
        });

        $this[0].uploader.bind("UploadProgress", function (up, file) {
          $("#" + file.id)
            .find(".progress")
            .width(file.percent + "%");
        });

        $this[0].uploader.bind("FileUploaded", function (up, file, response) {
          $fileDom = $("#" + file.id);
          response = $.parseJSON(response.response);

          $data = {
            file_id: file.id,
            id: $.stringRandom.generate(),
            filename: response.success.document.filename,
            mime: response.success.document.mime,
          };
          $html = $.itemRows.render(
            $("#" + opts.object + "-file-template").html(),
            $data
          );
          $fileDom.remove();

          if ($("#" + opts.object + "-rows").find("tbody tr:visible ").length) {
            $("#" + opts.object + "-rows")
              .find("tbody tr:visible:last")
              .after($html);
          } else {
            $("#" + opts.object + "-rows")
              .find("tbody")
              .prepend($html);
          }

          $.itemRows.reset_data();
        });
        $this[0].uploader.bind("UploadComplete", function () {
          uploading = 0;
        });
      },
      removeFile: function ($uploader, file_id, type, id) {
        $("#save-session-header").hide();
        $.dialog.confirm({
          title: "Delete Item",
          description: "Are you sure you want to delete this item?",
          actionText: "Delete",
          callback: function () {
            $uploader[0].uploader.removeFile(file_id);

            var $row = $("#item-row-" + type + "-" + id),
              $parent = $row.parent();

            $row.fadeOut(function () {
              if (
                $(this)
                  .find('input[name="' + type + "[" + id + '][object_id]"]')
                  .val() !== ""
              ) {
                $(this)
                  .remove()
                  .insertAfter($parent.find("tr:last"))
                  .find('input[name="' + type + "[" + id + '][action]"]')
                  .val("delete");
              } else {
                $(this).remove();
              }

              if (!$parent.find("tr:visible").length) {
                $("#item-row-no-results-" + type).show();
              }
              $.itemRows.update_totals();
            });

            return;
          },
        });
      },
    };

    $(function () {
      // Initialize the forms methods
      $.uploads.init();
    });
  })(jQuery);
  (function ($) {
    $.network = {
      check: function (opts) {
        $.ajax({
          url:
            $baseURL +
            "/session-template-core/images/icons/favicon.ico?_=" +
            new Date().getTime(),
          timeout: 5e3, // sets timeout to a fancy 5 seconds
          method: "GET",
          success: function (data, textStatus, xhr) {
            if (opts.isUp && typeof opts.isUp === "function") {
              log("Network is UP");
              opts.isUp();
            }
          },
          error: function (xhr) {
            if (opts.isDown && typeof opts.isDown === "function") {
              log("Network is DOWN");
              opts.isDown();
            }
          },
        });
      },
    };
  })(jQuery);
  (function ($) {
    $.language = {
      init: function () {
        // load lang from storage or default to settings....
        $.local.DB.getItem("language", function (err, value) {
          if (err || !value) {
            $.language.switch($settings["language"]);
          } else {
            $.language.switch(value);
            $settings["language"] = value;
          }
        });
      },
      switch: function (lang) {
        $("[data-lang]").each(function () {
          $(this).text($lang[lang][$(this).data("lang")]);
        });
        $("#languages-navigation li").removeClass("active");
        $("#lang-" + lang).addClass("active");

        // save lang to local storage & settings
        $settings["language"] = lang;
        $.local.DB.setItem("language", lang);
      },
    };
    $(function () {
      $.language.init();
    });
  })(jQuery);
}

(function ($) {
  $.tour = {
    version: "1.0.1",
    init: function () {
      if ($(".latest-tour-wrapper").length <= 0) {
        return;
      }

      $.tour.tourWrapper = $(".latest-tour-wrapper");

      var coverLayer = $(".cover-layer"),
        tourStepInfo = $(".more-info"),
        tourTrigger = $("#tour-trigger");

      $.tour.setSteps();

      tourTrigger.on("click", function () {
        //start tour

        if ($(".tour-wrapper").length) {
          $.tour.tourWrapper = $(".tour-wrapper");
          $.tour.setSteps();
        }

        if (!$.tour.tourWrapper.hasClass("active")) {
          //in that case, the tour has not been started yet
          $.tour.tourWrapper.addClass("active");
          $.tour.showStep($.tour.tourSteps.eq(0), coverLayer);
        }
        return false;
      });

      $.local.DB.getItem("tour_version", function (err, value) {
        if (
          !err &&
          (!value || value !== $.tour.version) &&
          !$.tour.tourWrapper.hasClass("active")
        ) {
          $.tour.tourWrapper.addClass("active");
          $.tour.showStep($.tour.tourSteps.eq(0), coverLayer);
          $.local.DB.setItem("tour_version", $.tour.version);
        }
      });

      //change visible step
      tourStepInfo.on("click", ".prev", function (event) {
        //go to prev step - if available
        !$(event.target).hasClass("inactive") &&
          $.tour.changeStep($.tour.tourSteps, coverLayer, "prev");
        return false;
      });
      tourStepInfo.on("click", ".next", function (event) {
        //go to next step - if available
        !$(event.target).hasClass("inactive") &&
          $.tour.changeStep($.tour.tourSteps, coverLayer, "next");
        return false;
      });

      //close tour
      tourStepInfo.on("click", ".close", function (event) {
        $.tour.closeTour($.tour.tourSteps, $.tour.tourWrapper, coverLayer);
        return false;
      });

      //detect swipe event on mobile - change visible step
      tourStepInfo.on("swiperight", function (event) {
        //go to prev step - if available
        if (
          !$(this).find(".prev").hasClass("inactive") &&
          $.tour.viewportSize() == "mobile"
        )
          $.tour.changeStep($.tour.tourSteps, coverLayer, "prev");
        return false;
      });
      tourStepInfo.on("swipeleft", function (event) {
        //go to next step - if available
        if (
          !$(this).find(".next").hasClass("inactive") &&
          $.tour.viewportSize() == "mobile"
        )
          $.tour.changeStep($.tour.tourSteps, coverLayer, "next");
        return false;
      });
    },
    setSteps: function () {
      $.tour.tourSteps = $.tour.tourWrapper.children("li");
      $.tour.stepsNumber = $.tour.tourSteps.length;
      //create the navigation for each step of the tour
      $.tour.createNavigation($.tour.tourSteps, $.tour.stepsNumber);
    },
    createNavigation: function (steps, n) {
      var tourNavigationHtml =
        '<div class="nav"><span><b class="actual-step">1</b> of ' +
        n +
        '</span><ul class="tour-nav"><li><a href="#0" class="prev">« Previous</a></li><li><a href="#0" class="next">Next »</a></li></ul></div><a href="#0" class="close">Close</a>';

      steps.each(function (index) {
        var step = $(this),
          stepNumber = index + 1,
          nextClass = stepNumber < n ? "" : "inactive",
          prevClass = stepNumber == 1 ? "inactive" : "";

        step.find(".nav,.close").remove();
        var nav = $(tourNavigationHtml)
          .find(".next")
          .addClass(nextClass)
          .end()
          .find(".prev")
          .addClass(prevClass)
          .end()
          .find(".actual-step")
          .html(stepNumber)
          .end()
          .appendTo(step.children(".more-info"));
      });
    },
    showStep: function (step, layer) {
      step.addClass("is-selected").removeClass("move-left");
      $.tour.smoothScroll(step.children(".more-info"));
      $.tour.showLayer(layer);
    },
    smoothScroll: function (element) {
      element.offset().top < $(window).scrollTop() &&
        $("body,html").animate({ scrollTop: element.offset().top }, 100);
      element.offset().top + element.height() >
        $(window).scrollTop() + $(window).height() &&
        $("body,html").animate(
          {
            scrollTop:
              element.offset().top + element.height() - $(window).height(),
          },
          100
        );
    },
    showLayer: function (layer) {
      layer
        .addClass("is-visible")
        .on(
          "webkitAnimationEnd oanimationend msAnimationEnd animationend",
          function () {}
        );
    },
    changeStep: function (steps, layer, bool) {
      var visibleStep = steps.filter(".is-selected"),
        delay = $.tour.viewportSize() == "desktop" ? 300 : 0;
      visibleStep.removeClass("is-selected");

      bool == "next" && visibleStep.addClass("move-left");

      setTimeout(function () {
        bool == "next"
          ? $.tour.showStep(visibleStep.next(), layer)
          : $.tour.showStep(visibleStep.prev(), layer);
      }, delay);
    },
    closeTour: function (steps, wrapper, layer) {
      steps.removeClass("is-selected move-left");
      wrapper.removeClass("active");
      layer.removeClass("is-visible");
    },
    viewportSize: function () {
      /* retrieve the content value of .main::before to check the actua mq */
      return window
        .getComputedStyle(
          document.querySelector(".latest-tour-wrapper"),
          "::before"
        )
        .getPropertyValue("content")
        .replace(/"/g, "")
        .replace(/'/g, "");
    },
  };

  $(function () {
    $.tour.init();
  });
})(jQuery);

setCanvas("canvas_1");
canvas_state[1] = $.canvas;

function setCanvas(new_canvas) {
  (function ($) {
    $(".canvas-content").hide();
    if (new_canvas) {
      $("#" + new_canvas)
        .parent(".canvas-content")
        .show();
    } else {
    }

    var containerHeight = $(".creating-session").outerHeight();
    var headerHeight = $(".header-part").outerHeight();
    var footerHeight = $(".footer-part").outerHeight();
    var totalOfHeaderFooter = headerHeight + footerHeight;
    var finalHeight = containerHeight - totalOfHeaderFooter;
    var parentWidth = $(".canvas-content:visible").width();

    $.canvas = {
      object: $(".canvas:visible")[0].getContext("2d"),
      size: { width: parentWidth, height: finalHeight },
      scaledSize: { width: parentWidth, height: finalHeight },
      scaledRatio: 1,
      panX: 0,
      panY: 0,
      zoomTracking: 0,
      getOffset: function (e) {
        if (
          e.type == "touchstart" ||
          e.type == "touchmove" ||
          e.type == "touchend" ||
          e.type == "touchcancel"
        ) {
          var touch =
            e.originalEvent.touches[0] || e.originalEvent.changedTouches[0];

          e.pageX = touch.pageX;
          e.pageY = touch.pageY;
        } else if (
          e.type == "mousedown" ||
          e.type == "mouseup" ||
          e.type == "mousemove" ||
          e.type == "mouseover" ||
          e.type == "mouseout" ||
          e.type == "mouseenter" ||
          e.type == "mouseleave"
        ) {
        }
        var canvasOffset = $(".canvas:visible").offset(),
          zoomBy = 1 + $.canvas.zoomTracking / 10,
          mouseX = Math.round(
            (parseInt(parseInt(e.pageX) - canvasOffset.left - $.canvas.panX) /
              zoomBy) *
              $.canvas.scaledRatio
          ),
          mouseY = Math.round(
            (parseInt(parseInt(e.pageY) - canvasOffset.top - $.canvas.panY) /
              zoomBy) *
              $.canvas.scaledRatio
          );
        return { x: mouseX, y: mouseY };
      },
      scale: function (e, $direction) {
        if (
          ($direction === "down" && $.canvas.zoomTracking <= 1) ||
          ($direction === "up" && $.canvas.zoomTracking >= 10)
        ) {
          if ($direction === "down") {
            $.canvas.panX = 0;
            $.canvas.panY = 0;
            $.canvas.zoomTracking = 0;
            if ($("#adjust").parent().hasClass("active")) {
              $.canvas.items.set(
                $("#movement-navigation li:first a"),
                "drag_items",
                "init_click",
                e
              );
            }
            $("#adjust").addClass("disabled").parent().removeClass("active");
          }
          $.canvas.reset();
          return;
        }

        if ($direction === "down") {
          $.canvas.zoomTracking--;
        } else {
          $.canvas.zoomTracking++;
        }

        $("#adjust").removeClass("disabled");

        //update pan coords so we move the middle of screen..
        var zoomBy = 1 + $.canvas.zoomTracking / 10,
          zoomByPrevious = 1 + ($.canvas.zoomTracking - 1) / 10,
          adjustedXBy = Math.floor(
            ($.canvas.scaledSize.width * zoomByPrevious -
              $.canvas.scaledSize.width * zoomBy) /
              2
          ),
          adjustedYBy = Math.floor(
            ($.canvas.scaledSize.height * zoomByPrevious -
              $.canvas.scaledSize.height * zoomBy) /
              2
          );

        if ($direction === "down") {
          $.canvas.panX -= adjustedXBy;
          $.canvas.panY -= adjustedYBy;
        } else {
          $.canvas.panX += adjustedXBy;
          $.canvas.panY += adjustedYBy;
        }
        $.canvas.pan.constraint(e);
        $.canvas.reset();
      },
      clearAll: function () {
        $.dialog.confirm({
          title: "",
          description: "Clear current practice slide",
          cancelText: "Cancel",
          actionText: "Confirm",
          callback: function () {
            $.canvas.history.objects = [];
            $("#canvas-notes").val("");
            $.canvas.reset();
            $.canvas.history.clearAutoSave();
            return false;
          },
        });
      },
      resetCaches: function () {
        // loop all history elements and re-cache images...
        var $currentObjects = $.canvas.history.currentObjects();
        if ($currentObjects.length) {
          for (var i = 0; i < $currentObjects.length; i++) {
            // if item has functino, then recahce...

            if ($.canvas.items[$currentObjects[i].type].setCache) {
              $.canvas.items[$currentObjects[i].type].setCache(
                $currentObjects[i]
              );
            }
          }
        }
      },
      reset: function () {
        // clear the canvas
        $.canvas.object.clearRect(
          0,
          0,
          $.canvas.size.width,
          $.canvas.size.height
        );

        var zoomBy = 1 + $.canvas.zoomTracking / 10;
        $.canvas.object.setTransform(
          zoomBy,
          0,
          0,
          zoomBy,
          $.canvas.panX * $.canvas.scaledRatio,
          $.canvas.panY * $.canvas.scaledRatio
        );

        // render the pitch
        $.canvas.items.pitch.init();

        // redraw all previous history
        var $currentObjects = $.canvas.history.currentObjects();

        if ($currentObjects.length) {
          for (var i = 0; i < $currentObjects.length; i++) {
            $.canvas.items[$currentObjects[i].type].draw($currentObjects[i], i);
          }
        }

        if ($.canvas.items.current) {
          if ($.canvas.items.current.endX && $.canvas.items.current.endY) {
            $.canvas.items[$.canvas.items.current.type].draw(
              $.canvas.items.current
            );
          }
        }
      },
      copyrightImg: function () {
        // add copyright text, so its always on top...
        var screenWidth = $(window).width();
        var zoomBy = 1 + $.canvas.zoomTracking / 10;
        if ($settings.copyright) {
          var txt = "www.touchtight.com \u00A9";
          // apply text shadow...
          $.canvas.object.save();
          // apply text shadow...
          $.canvas.object.font =
            " normal " + 25 / zoomBy + 'px "Helvetica Neue", Helvetica, Arial';
          $.canvas.object.fillStyle = "white";
          $.canvas.object.textAlign = "left";
          $.canvas.object.textBaseline = "top";

          if (
            $.canvas.items.pitch.colour === "mono" ||
            $.canvas.items.pitch.colour === "plane-white"
          ) {
            $.canvas.object.shadowColor = "white";
            $.canvas.object.fillStyle = "black";
          }

          var textWidth = $.canvas.object.measureText(txt).width;

          // MAC PC
          if (navigator.appVersion.indexOf("Mac") > 0) {
            var val = parseFloat(screenWidth / 2) - textWidth / 2.8;
            $.canvas.object.font =
              " normal " +
              18 / zoomBy +
              'px "Helvetica Neue", Helvetica, Arial';
            $.canvas.object.fillText(
              txt,
              (val - $.canvas.panX * $.canvas.scaledRatio) / zoomBy,
              ($.canvas.size.height -
                33 -
                $.canvas.panY * $.canvas.scaledRatio) /
                zoomBy
            );
            $.canvas.object.restore();
          } else {
            //console.log("uiuuiiui"+$.canvas.object);
            var element = document.getElementById("canvas_1");
            var val = parseFloat(screenWidth / 2) - textWidth / 3;
            $.canvas.object.font =
              " normal " +
              16 / zoomBy +
              'px "Helvetica Neue", Helvetica, Arial';
            //for copyright text
            //$.canvas.object.fillText(txt,x-970,x-930);
            $.canvas.object.fillText(
              txt,
              (val - $.canvas.panX * $.canvas.scaledRatio) / zoomBy -
                $.canvas.panX,
              ($.canvas.size.height -
                28 -
                $.canvas.panY * $.canvas.scaledRatio) /
                zoomBy
            );
            $.canvas.object.restore();
          }

          // put image in canvas
          img = new Image();
          if (
            $.canvas.items.pitch.current == "pitch_53" ||
            $.canvas.items.pitch.current == "pitch_54" ||
            $.canvas.items.pitch.current == "pitch_55" ||
            $.canvas.items.pitch.current == "pitch_56" ||
            $.canvas.items.pitch.current == "pitch_57" ||
            $.canvas.items.pitch.current == "pitch_58" ||
            $.canvas.items.pitch.current == "pitch_59" ||
            $.canvas.items.pitch.current == "pitch_60" ||
            $.canvas.items.pitch.current == "pitch_61" ||
            $.canvas.items.pitch.current == "pitch_62" ||
            $.canvas.items.pitch.current == "pitch_63" ||
            $.canvas.items.pitch.current == "pitch_64" ||
            $.canvas.items.pitch.current == "pitch_65" ||
            $.canvas.items.pitch.current == "pitch_66" ||
            $.canvas.items.pitch.current == "pitch_67" ||
            $.canvas.items.pitch.current == "pitch_68" ||
            $.canvas.items.pitch.current == "pitch_18" ||
            $.canvas.items.pitch.current == "pitch_19" ||
            $.canvas.items.pitch.current == "pitch_20" ||
            $.canvas.items.pitch.current == "pitch_21" ||
            $.canvas.items.pitch.current == "pitch_22" ||
            $.canvas.items.pitch.current == "pitch_23" ||
            $.canvas.items.pitch.current == "pitch_24" ||
            $.canvas.items.pitch.current == "pitch_25" ||
            $.canvas.items.pitch.current == "pitch_26" ||
            $.canvas.items.pitch.current == "pitch_27" ||
            $.canvas.items.pitch.current == "pitch_28" ||
            $.canvas.items.pitch.current == "pitch_29" ||
            $.canvas.items.pitch.current == "pitch_30" ||
            $.canvas.items.pitch.current == "pitch_31" ||
            $.canvas.items.pitch.current == "pitch_32" ||
            $.canvas.items.pitch.current == "pitch_33" ||
            $.canvas.items.pitch.current == "pitch_34"
          ) {
            var img = $(".touchiight-copyright-img-3d");
            $.canvas.object.drawImage(
              img[0],
              $.canvas.size.width / 2 - 62.5,
              $.canvas.size.height / 2 - 32
            );
          } else if ($.canvas.items.pitch.current == "pitch_52") {
          } else {
            var img = $(".touchiight-copyright-img");
            // $.canvas.object.globalAlpha = 0.20;
            // $.canvas.object.drawImage(img[0], $.canvas.size.width / 2 - 50, $.canvas.size.height / 2 - 50,100,100);
            // $.canvas.object.globalAlpha = 1.0;
          }
        }

        // add powered_by text, so its always on top...
        if ($settings.powered_by) {
          var txt = $settings.powered_by;

          // apply text shadow...
          $.canvas.object.save();
          // apply text shadow...
          $.canvas.object.shadowColor = "black";
          $.canvas.object.shadowBlur = 13;

          $.canvas.object.font =
            "bold italic " +
            36 / zoomBy +
            'px "Helvetica Neue", Helvetica, Arial';
          $.canvas.object.fillStyle = "white";
          $.canvas.object.textAlign = "left";
          $.canvas.object.textBaseline = "top";

          if ($.canvas.items.pitch.colour === "mono") {
            $.canvas.object.shadowColor = "white";
            $.canvas.object.fillStyle = "black";
          }

          $.canvas.object.fillText(
            txt,
            (50 - $.canvas.panX * $.canvas.scaledRatio) / zoomBy,
            ($.canvas.size.height - 98 - $.canvas.panY * $.canvas.scaledRatio) /
              zoomBy
          );
          $.canvas.object.restore();
        }
      },
    };

    setNotes();
    setHistory();
    setItems();
    initializeCanvasContent();

    shadowStyle();
    drawCircle();
    circle_highlight();
    textarea_opposition();
    canvasText();
    if (
      navigator.userAgent.indexOf("Firefox") > 0 ||
      navigator.appName == "Microsoft Internet Explorer" ||
      !!(
        navigator.userAgent.match(/Trident/) ||
        navigator.userAgent.match(/rv:11/)
      ) ||
      (typeof $.browser !== "undefined" && $.browser.msie == 1)
    ) {
      draggable_sizes();
    } else {
      draggable_sizes_chrome();
    }
    setAllItems();
    setPitch();
    setResize();
    canvasFunctions();
    $(".pitces").parent("li").removeClass("active");
    $("#" + $.canvas.items.pitch.current)
      .parent("li")
      .addClass("active");
  })(jQuery);
}

setNotes();
function setNotes() {
  (function ($) {
    $.canvas.pan = {
      init: function (e) {
        if (
          $("#adjust").hasClass("disabled") ||
          $("#adjust").parent().hasClass("active")
        ) {
          if ($("#adjust").parent().hasClass("active")) {
            $.canvas.items.set(
              $("#movement-navigation li:first a"),
              "drag_items",
              "init_click",
              e
            );
          }
          $("#adjust").parent().removeClass("active");
          return;
        }

        $.canvas.items.clear();
        $("#adjust").parent().addClass("active");

        $this = $.canvas.pan;
        $(".canvas:visible").on("mousedown touchstart", function (e) {
          $this.onStart(e);
        });
        $(".canvas:visible").on("mousemove touchmove", function (e) {
          $this.onMove(e);
        });
        $(".canvas:visible").on("mouseup touchend mouseout", function (e) {
          $this.onEnd(e);
        });

        $(".canvas:visible").addClass("pan");
      },
      onStart: function (e) {
        e.stopPropagation();
        e.preventDefault();

        var canvasOffset = $(".canvas:visible").offset(),
          zoomBy = 1 + $.canvas.zoomTracking / 10;
        if (
          e.type == "touchstart" ||
          e.type == "touchmove" ||
          e.type == "touchend" ||
          e.type == "touchcancel"
        ) {
          var touch =
            e.originalEvent.touches[0] || e.originalEvent.changedTouches[0];
          e.pageX = touch.pageX;
          e.pageY = touch.pageY;
        } else if (
          e.type == "mousedown" ||
          e.type == "mouseup" ||
          e.type == "mousemove" ||
          e.type == "mouseover" ||
          e.type == "mouseout" ||
          e.type == "mouseenter" ||
          e.type == "mouseleave"
        ) {
        }
        var mouseX = parseInt(e.pageX - canvasOffset.left);
        var mouseY = parseInt(e.pageY - canvasOffset.top);

        $.canvas.pan.startPosition = {
          x: mouseX - $.canvas.panX,
          y: mouseY - $.canvas.panY,
        };

        $.canvas.pan.isDown = true;

        $(".canvas:visible").addClass("panning");
      },
      onEnd: function (e) {
        e.stopPropagation();
        e.preventDefault();

        $.canvas.pan.isDown = false;
        $.canvas.pan.startPosition = null;

        $(".canvas:visible").removeClass("panning");
      },
      onMove: function (e) {
        if (
          e.type == "touchstart" ||
          e.type == "touchmove" ||
          e.type == "touchend" ||
          e.type == "touchcancel"
        ) {
          var touch =
            e.originalEvent.touches[0] || e.originalEvent.changedTouches[0];
          e.pageX = touch.pageX;
          e.pageY = touch.pageY;
        } else if (
          e.type == "mousedown" ||
          e.type == "mouseup" ||
          e.type == "mousemove" ||
          e.type == "mouseover" ||
          e.type == "mouseout" ||
          e.type == "mouseenter" ||
          e.type == "mouseleave"
        ) {
        }
        if (!$.canvas.pan.isDown) {
          return;
        }

        e.stopPropagation();
        e.preventDefault();
        var canvasOffset = $(".canvas:visible").offset(),
          zoomBy = 1 + $.canvas.zoomTracking / 10;

        var mouseX = parseInt(e.pageX - canvasOffset.left);
        var mouseY = parseInt(e.pageY - canvasOffset.top);

        var mouseXT = parseInt((mouseX - $.canvas.panX) / zoomBy);
        var mouseYT = parseInt((mouseY - $.canvas.panY) / zoomBy);

        $.canvas.panX = mouseX - $.canvas.pan.startPosition.x;
        $.canvas.panY = mouseY - $.canvas.pan.startPosition.y;

        $.canvas.pan.constraint(e);
        $.canvas.reset();
      },
      constraint: function (e) {
        if (
          e.type == "touchstart" ||
          e.type == "touchmove" ||
          e.type == "touchend" ||
          e.type == "touchcancel"
        ) {
          var touch =
            e.originalEvent.touches[0] || e.originalEvent.changedTouches[0];
          e.pageX = touch.pageX;
          e.pageY = touch.pageY;
        } else if (
          e.type == "mousedown" ||
          e.type == "mouseup" ||
          e.type == "mousemove" ||
          e.type == "mouseover" ||
          e.type == "mouseout" ||
          e.type == "mouseenter" ||
          e.type == "mouseleave"
        ) {
        }
        var canvasOffset = $(".canvas:visible").offset(),
          zoomBy = 1 + $.canvas.zoomTracking / 10,
          mouseX = parseInt(e.pageX - canvasOffset.left),
          mouseY = parseInt(e.pageY - canvasOffset.top);

        var maxLeft = Math.floor(
          $.canvas.scaledSize.width - $.canvas.scaledSize.width * zoomBy
        );
        var maxTop = Math.floor(
          $.canvas.scaledSize.height - $.canvas.scaledSize.height * zoomBy
        );
        // Add constrainst...
        if ($.canvas.panX > 0) {
          $.canvas.panX = 0;
          if ($.canvas.pan.startPosition) {
            $.canvas.pan.startPosition.x = mouseX;
          }
        }
        if (maxLeft > $.canvas.panX) {
          $.canvas.panX = maxLeft;
        }
        if ($.canvas.panY > 0) {
          $.canvas.panY = 0;
          if ($.canvas.pan.startPosition) {
            $.canvas.pan.startPosition.y = mouseY;
          }
        }
        if (maxTop > $.canvas.panY) {
          $.canvas.panY = maxTop;
        }
      },
      destroy: function () {
        $(".canvas:visible").removeClass("pan panning");
        $(".canvas:visible").off(
          "mousedown touchstart mousemove touchmove mouseup touchend mouseout, contextmenu"
        );
        $(".delete-item").off("click");
        $(".delete-item").off("touchstart");
        $(".clone-item").off("click");
        $(".clone-item").off("touchstart");
      },
    };
  })(jQuery);
  (function ($) {
    $.canvas.notes = {
      init: function () {
        $("#canvas-notes").bind(
          "keydown keyup keypress cut copy past blur change",
          function () {
            $.canvas.notes.copyText();
          }
        );
      },
      copyText: function () {
        $("#printable_notes").text($("#canvas-notes").val());
      },
    };
    $(function () {
      $.canvas.notes.init();
    });
  })(jQuery);
}

//setHistory();
function setHistory() {
  (function ($) {
    $.canvas.history = {
      maxSize: 50,
      objects: [],
      init: function () {
        // Check for Autosave Data...
        if (next_click == 0) {
          $.canvas.history.checkForAutoSave();
        }
      },
      currentObjects: function () {
        if (!$.canvas.history.objects.length) {
          return false;
        }
        return $.canvas.history.objects[$.canvas.history.objects.length - 1];
      },
      append: function ($objects) {
        $newHistory = $.extend(true, [], $.canvas.history.currentObjects());
        $newHistory.push($objects);
        if (
          $.canvas.history.maxSize &&
          $.canvas.history.objects.length >= $.canvas.history.maxSize
        ) {
          $.canvas.history.objects.splice(0, 1);
          log("History object too large - removing older data!");
        }
        $.canvas.history.objects.push($newHistory);
        $(".undoBtn").removeClass("disabled");

        // autoSave...
        $.canvas.history.doAutoSave();
      },
      appendAll: function ($array) {
        if (
          $.canvas.history.maxSize &&
          $.canvas.history.objects.length >= $.canvas.history.maxSize
        ) {
          $.canvas.history.objects.splice(0, 1);

          log("History object too large - removing older data!");
        }
        $.canvas.history.objects.push($array);
        $(".undoBtn").removeClass("disabled");
        // autoSave...
        $.canvas.history.doAutoSave();
      },
      remove: function (index) {
        var history = $.canvas.history.currentObjects();
        if (index > -1 && index < history.length) {
          history.splice(index, 1);
        } else {
          log("cannot remove object - out of range!");
        }
        // autoSave...
        $.canvas.history.doAutoSave();
      },
      undo: function () {
        copy_object = {};
        // remove last element
        if (
          $.canvas.history.objects.length > 1 ||
          ($.canvas.history.objects.length === 1 &&
            $.canvas.history.objects[0].length === 1)
        ) {
          redo_objects.push(
            $.canvas.history.objects[$.canvas.history.objects.length - 1]
          );
          $.canvas.history.objects.pop();
        } else if (
          $.canvas.history.objects[0] &&
          $.canvas.history.objects[0].length > 1
        ) {
          $.canvas.history.objects[0].pop();
        } else {
          log("undo history empty");
        }
      },
      doUndo: function () {
        $.canvas.history.undo();
        $.canvas.reset();
        if ($.canvas.history.objects.length <= 1) {
          $(".undoBtn").addClass("disabled");
        }
        // autoSave...
        $.canvas.history.doAutoSave();
      },
      doRedo: function () {
        copy_object = {};
        if (redo_objects.length < 1) {
          return false;
        }
        $.canvas.history.objects.push(redo_objects[redo_objects.length - 1]);
        redo_objects.pop();
        $.canvas.reset();
        // autoSave...
        $.canvas.history.doAutoSave();
      },
      checkForAutoSave: function () {
        $.local.DB.getItem("autosave1", function (err, value) {
          if (!err && value) {
            $.canvas.history.clearAutoSave();
            try {
              pitch_number_old = localStorage.pitch_number
                ? localStorage.pitch_number
                : 0;
              localStorage.pitch_number = 0;
            } catch (ex) {}
            pitch_number = 0;
            is_history = 0;
            $(".select-pitch").show();
            $.dialog.confirm(
              {
                title: "Now, where were you?",
                description:
                  "Is this a new session or would you like to load a previous session?",
                cancelText: "New",
                actionText: "Load",
                callback: function () {
                  $.importer.doImport(value);
                },
              },
              "session_history"
            );
          } else {
            if (
              navigator.appName == "Microsoft Internet Explorer" ||
              !!(
                navigator.userAgent.match(/Trident/) ||
                navigator.userAgent.match(/rv:11/)
              ) ||
              (typeof $.browser !== "undefined" && $.browser.msie == 1)
            ) {
              $(".select-pitch").hide();
            } else {
              $(".select-pitch").show();
            }
          }
        });
      },
      doAutoSave: function () {
        // grab the export code...
        // and save it to local storage...
        $.local.DB.setItem("autosave1", $.importer.getExportData());
      },
      clearAutoSave: function () {
        $.local.DB.removeItem("autosave1");
      },
    };

    $(function () {
      $.canvas.history.init();
    });
  })(jQuery);
}

setItems();
function setItems() {
  (function ($) {
    $.canvas.items = {
      current: null,
      init: function () {
        $item = $("#left-navigation ul li.active:first a");
        $item.trigger("click");

        $(".canvas:visible").on("dblclick", $.canvas.items.editText);
        $("#right-number").on("click touchstart", $.canvas.items.editText);
        $("#above-name").on("click touchstart", $.canvas.items.editName);
        $("#above-comment").on("click touchstart", $.canvas.items.editComment);
      },
      clear: function () {
        $(".navigation ul:not(.not-settable) li").removeClass("active");
        if ($.canvas.items.current) {
          $.canvas.items[$.canvas.items.current.type].destroy();
        }
      },
      editText: function (e) {
        var $isCollision = $.canvas.items.detectCollision(e),
          $currentObjects = $.canvas.history.currentObjects();
        if (!$isCollision || JSON.stringify(copy_object) != "{}") {
          $isCollision = is_Collision;
          $("#item-right-section").hide();
        }

        if ($currentObjects[$isCollision.id].text == undefined) {
          $currentObjects[$isCollision.id].text = "";
        }
        if (
          $isCollision &&
          $currentObjects[$isCollision.id].text !== undefined
        ) {
          var $obj = $currentObjects[$isCollision.id];
          $obj.name = "";
          console.log($.canvas.items[$obj.type]);
          $.canvas.items[$obj.type].editText($isCollision.id, $obj);
        }
      },
      editName: function (e) {
        var $isCollision = $.canvas.items.detectCollision(e),
          $currentObjects = $.canvas.history.currentObjects();
        if (!$isCollision || JSON.stringify(copy_object) != "{}") {
          $isCollision = is_Collision;
          $("#item-right-section").hide();
        }
        if ($currentObjects[$isCollision.id].abovename == undefined) {
          $currentObjects[$isCollision.id].abovename = "";
        }
        if (
          $isCollision &&
          $currentObjects[$isCollision.id].abovename !== undefined
        ) {
          var $obj = $currentObjects[$isCollision.id];
          $obj.name = "above-name";
          $.canvas.items[$obj.type].editText($isCollision.id, $obj);
        }
      },
      editComment: function (e) {
        var $isCollision = $.canvas.items.detectCollision(e),
          $currentObjects = $.canvas.history.currentObjects();

        if (!$isCollision || JSON.stringify(copy_object) != "{}") {
          $isCollision = is_Collision;
          $("#item-right-section").hide();
        }

        if ($currentObjects[$isCollision.id].abovecomment == undefined) {
          $currentObjects[$isCollision.id].abovecomment = "";
        }
        if (
          $isCollision &&
          $currentObjects[$isCollision.id].abovecomment !== undefined
        ) {
          var $obj = $currentObjects[$isCollision.id];
          $obj.name = "above-comment";
          $.canvas.items[$obj.type].editText($isCollision.id, $obj);
        }
      },
      set: function ($clickobj, $item, $function, event) {
        $.canvas.pan.destroy();
        $(".navigation:not(#languages-navigation)")
          .find("ul:not(.not-settable) li")
          .removeClass("active");
        $($clickobj).parent().parent().addClass("active");
        if ($.canvas.items.current) {
          $.canvas.items[$.canvas.items.current.type].destroy();
        }
        $.canvas.items.current = { type: $item };
        if ($function) {
          $func = $.canvas.items[$.canvas.items.current.type][$function];
          if (typeof $func === "function") {
            $func();
          } else {
            $.canvas.items[$.canvas.items.current.type].init($clickobj);
          }
        } else {
          $.canvas.items[$.canvas.items.current.type].init($clickobj, event);
        }
      },
      render: function ($type) {
        $.canvas.items.current.isDown = false;
        $.canvas.items.current.cache = $.canvas.items[
          $.canvas.items.current.type
        ].setCache($.canvas.items.current);
        // push new object not reference to object...$.extend(true, {}, $.canvas.items.current)
        if ($.canvas.items.current.endX && $.canvas.items.current.endY) {
          $object = $.extend(true, [], $.canvas.items.current);
          $object.hitarea = $.canvas.items[
            $.canvas.items.current.type
          ].drawHitArea(
            $.canvas.items.current,
            $(".canvas:visible").attr("id")
          );

          $.canvas.history.append($object);
        }
        // alert($.canvas.items.current.endX);
        $.canvas.items.current = { type: $type };
      },
      getCollision: function (e) {
        // get the current canvas objects

        var mousePosition = $.canvas.getOffset(e);
        (getCollision = false),
          ($currentObjects = $.canvas.history.currentObjects());

        if ($currentObjects.length) {
          for (var i = 0; i < $currentObjects.length; i++) {
            var coords = $.canvas.items[$currentObjects[i].type].getCoords(
              $currentObjects[i]
            );

            if (
              coords.right >= mousePosition.x &&
              coords.left <= mousePosition.x &&
              coords.bottom >= mousePosition.y &&
              coords.top <= mousePosition.y
            ) {
              // get the offsite canvas element
              $hitarea = $currentObjects[i].hitarea[0].getContext("2d");
              var pixel = $hitarea.getImageData(
                mousePosition.x - coords.left,
                mousePosition.y - coords.top,
                1,
                1
              ).data;
              hitted = pixel[3] > 0;
              if (hitted) {
                getCollision = { id: coords };
              }
            }
          }
        }
        return getCollision;
      },
      detectCollision: function (e) {
        // get the current canvas objects
        var mousePosition = $.canvas.getOffset(e);
        (isCollision = false),
          ($currentObjects = $.canvas.history.currentObjects());
        if ($currentObjects.length) {
          for (var i = 0; i < $currentObjects.length; i++) {
            var coords = $.canvas.items[$currentObjects[i].type].getCoords(
              $currentObjects[i]
            );
            if (
              coords.right >= mousePosition.x &&
              coords.left <= mousePosition.x &&
              coords.bottom >= mousePosition.y &&
              coords.top <= mousePosition.y
            ) {
              // get the offsite canvas element
              $hitarea = $currentObjects[i].hitarea[0].getContext("2d");
              var pixel = $hitarea.getImageData(
                mousePosition.x - coords.left,
                mousePosition.y - coords.top,
                1,
                1
              ).data;
              hitted = pixel[3] > 0;
              if (hitted) {
                isCollision = { id: i };
              }
            }
          }
        }
        return isCollision;
      },
      getLineLength: function (startX, startY, endX, endY) {
        return Math.sqrt(
          (startX - endX) * (startX - endX) + (startY - endY) * (startY - endY)
        );
      },
      getArcPoints: function (startX, startY, endX, endY, arcHeight) {
        var arcHeight = arcHeight ? arcHeight : 60,
          centrePoint = { x: (startX + endX) / 2, y: (startY + endY) / 2 },
          length = $.canvas.items.getLineLength(startX, startY, endX, endY),
          extraPixels = (length / 100) * arcHeight;

        // takes a value away for the y position of the control point to give a loopy
        // effect.
        centrePoint.y -= extraPixels;
        return centrePoint;
      },
      applyEnd: function (endX, endY) {
        $.canvas.object.beginPath();
        $.canvas.object.moveTo(endX, endX);
        $.canvas.object.lineWidth = 2;
        $.canvas.object.stroke();
        $.canvas.object.closePath();
      },
      applyArrow: function (startX, startY, endX, endY, isArc) {
        // angle between arrow head and main line.
        angle = Math.PI / 4.5;

        // length of the arrow head.
        d = 8;

        // For ends with arrow we actually want to stop before we get to the arrow
        // so that wide lines won't put a flat end on the arrow.
        var length = $.canvas.items.getLineLength(startX, startY, endX, endY);
        var ratio = (length - d / 3) / length;
        var tox, toy, fromx, fromy;

        tox = startX + (endX - startX) * ratio;
        toy = startY + (endY - startY) * ratio;

        fromx = startX;
        fromy = startY;

        // calculate the angle of the line
        var lineangle = Math.atan2(endY - startY, endX - startX);

        // h is the line length of a side of the arrow head
        var h = Math.abs(d / Math.cos(angle));

        // handle far end arrow head
        var angle1 = lineangle + Math.PI + angle;
        var topx = endX + Math.cos(angle1) * h;
        var topy = endY + Math.sin(angle1) * h;
        var angle2 = lineangle + Math.PI - angle;
        var botx = endX + Math.cos(angle2) * h;
        var boty = endY + Math.sin(angle2) * h;

        $.canvas.object.beginPath();
        $.canvas.object.moveTo(topx, topy);
        $.canvas.object.lineTo(endX, endY);
        $.canvas.object.lineTo(botx, boty);
        $.canvas.object.setLineDash([]);
        $.canvas.object.lineWidth = 2;
        $.canvas.object.stroke();
        $.canvas.object.closePath();
      },
      //function to add circle on head of line
      applyDot: function (startX, startY, endX, endY, lines_color) {
        // angle between arrow head and main line.
        angle = Math.PI / 4.5;

        // length of the arrow head.
        d = 20;

        // For ends with arrow we actually want to stop before we get to the arrow
        // so that wide lines won't put a flat end on the arrow.
        var length = $.canvas.items.getLineLength(startX, startY, endX, endY);
        var ratio = (length - d / 3) / length;
        var tox, toy, fromx, fromy;

        tox = startX + (endX - startX) * ratio;
        toy = startY + (endY - startY) * ratio;

        fromx = startX;
        fromy = startY;

        // calculate the angle of the line
        var lineangle = Math.atan2(endY - startY, endX - startX);

        // h is the line length of a side of the arrow head
        var h = Math.abs(d / Math.cos(angle));

        // handle far end arrow head
        var angle1 = lineangle + Math.PI + angle;
        var topx = endX + Math.cos(angle1) * h;
        var topy = endY + Math.sin(angle1) * h;
        var angle2 = lineangle + Math.PI - angle;
        var botx = endX + Math.cos(angle2) * h;
        var boty = endY + Math.sin(angle2) * h;

        $.canvas.object.beginPath();
        $.canvas.object.arc(endX, endY, 4, 0, 2 * Math.PI, false);

        if (lines_color) {
          $.canvas.object.fillStyle = lines_color;
        }
        if (lines_color) {
          $.canvas.object.strokeStyle = lines_color;
        }
        $.canvas.object.fill();
        $.canvas.object.setLineDash([]);
        $.canvas.object.lineWidth = 2;
        $.canvas.object.stroke();
        $.canvas.object.closePath();
      },

      applyEllipse: function (x, y, w, h, fill, shapes_color, shaded_shapes) {
        x = x - w / 2;
        y = y - h / 2;

        var k = 0.5522848;
        var ox = (w / 2) * k;
        var oy = (h / 2) * k;
        var xe = x + w;
        var ye = y + h;
        var xm = x + w / 2;
        var ym = y + h / 2;

        $.canvas.object.beginPath();
        $.canvas.object.moveTo(x, ym);
        $.canvas.object.bezierCurveTo(x, ym - oy, xm - ox, y, xm, y);
        $.canvas.object.bezierCurveTo(xm + ox, y, xe, ym - oy, xe, ym);
        $.canvas.object.bezierCurveTo(xe, ym + oy, xm + ox, ye, xm, ye);
        $.canvas.object.bezierCurveTo(xm - ox, ye, x, ym + oy, x, ym);

        if (shaded_shapes) {
          $.canvas.object.fillStyle = "rgba(0,0,0,0.3)";
          $.canvas.object.fill();
        }
        $.canvas.object.lineWidth = 2;
        if (shapes_color) {
          $.canvas.object.strokeStyle = shapes_color;
        }
        $.canvas.object.stroke();
        $.canvas.object.closePath();
      },
    };

    $.canvas.items.init();
  })(jQuery);

  // canvas base
  (function ($) {
    $.canvas.items.base = {
      defaults: {
        strokeStyle: "#ffffff",
        lineWidth: 6,
        lineJoin: "round",
        fillStyle: "rgba(0,0,0,0)",
      },
      hitAreaDefaults: {
        strokeStyle: "#000",
        lineWidth: 30,
        lineJoin: "round",
        fillStyle: "rgba(0,0,0,0)",
      },
      isdashed: false,
      isdotted: false,
      init: function () {
        $this = this;
        $.canvas.items.previousClass = $.canvas.items.current.type;
        if (
          $.canvas.items.current.type == "cones_yellow" ||
          $.canvas.items.current.type == "cones_orange"
        ) {
          $.canvas.items.previousBtn = $("#items-navigation li.active a");
        } else {
          $.canvas.items.previousBtn = $("#movement-navigation li.active a");
        }
        $(".canvas:visible").on("mousedown touchstart", function (e) {
          $this.onStart(e);
        });
        $(".canvas:visible").on("mousemove touchmove", function (e) {
          $this.onMove(e);
        });
        $(".canvas:visible").on("mouseup touchend mouseout", function (e) {
          $this.onEnd(e);
        });
      },
      isCollision: function (e, setDraggable) {
        $isCollision = $.canvas.items.detectCollision(e);
        if (!$.canvas.items.current.isDown && $isCollision) {
          $(".canvas:visible").addClass("move");
          $.canvas.items.drag_items.hoverCheck = true;
          $.canvas.items.drag_items.dragItemIndex = $isCollision.id;
          if (setDraggable) {
            $.canvas.items.set(
              $("#movement-navigation li:first a"),
              "drag_items"
            );
            // call the mousedown event manually, so we can passit a valid event variable
            $.canvas.items.drag_items.dragItemIndex = $isCollision.id;
            $.canvas.items.drag_items.onStart(e);
            $.canvas.items.drag_items.init_click(e);
          }
          return true;
        }
        return false;
      },
      onStart: function (e) {
        e.stopPropagation();
        e.preventDefault();

        $("#canvas-text").blur();
        if (this.isCollision(e, true)) {
          return;
        }
        if (!is_lines_shapes_text) {
          $("#without-shade").find("li").removeClass("shape_selected");
          $("#line-tools").find("li").removeClass("selected-lines");
          $(".textarea-movement-tool")
            .parent("li")
            .removeClass("textarea_active");
          $(".right-click-canvas").hide();
          $(".cp-color-picker").hide();
          return false;
        }
        $("#startDrag,#centerDrag,#endDrag").remove();
        var $objects = $.canvas.history.currentObjects();
        $.each($objects, function (i, item) {
          delete item.hasVisibleMarkers;
        });

        var mousePosition = $.canvas.getOffset(e);
        $.canvas.items.current.lines_color = $(".color_light_blue").css(
          "backgroundColor"
        );
        $.canvas.items.current.shapes_color = $(".shapes_color").css(
          "backgroundColor"
        );
        /*Condition to check shaded and unshaded shapes and fill it with black transparent color*/
        if ($("#shaded_shapes_button").hasClass("active_shade")) {
          $.canvas.items.current.shaded_shapes = "1";
        }
        $.canvas.items.current.startX = mousePosition.x;
        $.canvas.items.current.startY = mousePosition.y;
        startX_mobile = mousePosition.x;
        startY_mobile = mousePosition.y;

        $.canvas.items.current.isDown = true;
      },
      onEnd: function (e) {
        e.stopPropagation();
        e.preventDefault();
        $.canvas.items.render($.canvas.items.current.type);
      },
      onMove: function (e) {
        if (
          e.type == "touchstart" ||
          e.type == "touchmove" ||
          e.type == "touchend" ||
          e.type == "touchcancel"
        ) {
          var touch =
            e.originalEvent.touches[0] || e.originalEvent.changedTouches[0];
          e.pageX = touch.pageX;
          e.pageY = touch.pageY;
        } else if (
          e.type == "mousedown" ||
          e.type == "mouseup" ||
          e.type == "mousemove" ||
          e.type == "mouseover" ||
          e.type == "mouseout" ||
          e.type == "mouseenter" ||
          e.type == "mouseleave"
        ) {
        }
        e.stopPropagation();
        e.preventDefault();

        $(".canvas:visible").removeClass("move");
        if (this.isCollision(e)) {
          return;
        }

        var is_iPad = navigator.userAgent.match(/iPad/i) != null;
        is_device = isMobile();
        if (!$.canvas.items.current.isDown && is_iPad) {
        } else if (!$.canvas.items.current.isDown) {
          return;
        }
        var mousePosition = $.canvas.getOffset(e);
        $.canvas.items.current.endX = mousePosition.x;
        $.canvas.items.current.endY = mousePosition.y;
        if (is_device) {
          $.canvas.items.current.startX = startX_mobile;
          $.canvas.items.current.startY = startY_mobile;
        }

        $.canvas.reset();
      },
      updatePosition: function ($item, changedBy) {
        $item.startX += changedBy.x;
        $item.endX += changedBy.x;
        $item.startY += changedBy.y;
        $item.endY += changedBy.y;
        if ($item.centerX) {
          $item.centerX += changedBy.x;
        }
        if ($item.centerY) {
          $item.centerY += changedBy.y;
        }
      },
      setDefaults: function (hitarea) {
        if (hitarea) {
          $.each(this.hitAreaDefaults, function (i, item) {
            $.canvas.object[i] = item;
          });
        } else {
          $.each(this.defaults, function (i, item) {
            $.canvas.object[i] = item;
          });
        }
      },
      setCache: function ($item) {
        var cache = {};
        return cache;
      },
      getCoords: function ($item) {
        var left = $item.startX,
          right = $item.endX,
          top = $item.startY,
          bottom = $item.endY;

        //flipped horz...
        if (left > right) {
          right = left;
          left = $item.endX;
        }
        //flipped vert...
        if (top > bottom) {
          bottom = top;
          top = $item.endY;
        }

        if (bottom - top < this.hitAreaDefaults.lineWidth) {
          top -= this.hitAreaDefaults.lineWidth / 2;
          bottom += this.hitAreaDefaults.lineWidth / 2;
        }
        if (right - left < this.hitAreaDefaults.lineWidth) {
          left -= this.hitAreaDefaults.lineWidth / 2;
          right += this.hitAreaDefaults.lineWidth / 2;
        }

        return { left: left, right: right, top: top, bottom: bottom };
      },
      draw: function ($item) {
        // Should be overridden...
        this.setDefaults();
        if (this.isdashed) {
          $.canvas.object.setLineDash([16, 8]);
        } else if (this.isdotted) {
          $.canvas.object.setLineDash([8, 10]);
        } else {
          $.canvas.object.setLineDash([]);
        }

        if (
          $.canvas.items.pitch.colour === "mono" &&
          !(
            $item.type === "running" ||
            $item.type === "movement" ||
            $item.type === "arc" ||
            $item.type === "movement_opposition" ||
            $item.type === "arc_opposition"
          )
        ) {
          $.canvas.object.strokeStyle = "#555";
          $.canvas.object.fillStyle = "#555"; // for text
        }
        this._drawshape($item);
        console.log("1?");
        var $currentObjects = $.extend(
          true,
          [],
          $.canvas.history.currentObjects()
        );
        if ($currentObjects.length == 0 && is_Collision.id == undefined) {
          $.dialog.confirm(
            {
              title: "Right Click?",
              description:
                "Right Click Drag and Drop items to add names, numbers, rotate and change colours.",
              cancelText: "OK",
              callback: function () {},
            },
            "right-click"
          );
        }
      },
      _drawshape: function ($item) {
        console.log("2?");
        $.canvas.object.beginPath();
        $.canvas.object.moveTo($item.startX, $item.startY);
        $.canvas.object.lineTo($item.endX, $item.endY);
        $.canvas.object.lineWidth = 2;
        if ($item.lines_color) {
          $.canvas.object.strokeStyle = $item.lines_color;
        }
        $.canvas.object.stroke();
        $.canvas.object.closePath();
      },
      drawHitArea: function ($item) {
        $shape = $.extend(true, {}, $item);
        var $width = $shape.endX - $shape.startX,
          $height = $shape.endY - $shape.startY;
        $shape.startX = 0;
        $shape.endX = $width;
        $shape.startY = 0;
        $shape.endY = $height;

        //flipped horz...
        if ($width < 0) {
          $width = $shape.startX - $shape.endX;
          $shape.startX = $width;
          $shape.endX = 0;
        }
        //flipped vert...
        if ($height < 0) {
          $height = $shape.startY - $shape.endY;
          $shape.startY = $height;
          $shape.endY = 0;
        }

        var $tooSmall = false;
        if (
          $height < this.hitAreaDefaults.lineWidth ||
          $width < this.hitAreaDefaults.lineWidth
        ) {
          $tooSmall = true;
          $width =
            $width < this.hitAreaDefaults.lineWidth
              ? this.hitAreaDefaults.lineWidth
              : $width;
          $height =
            $height < this.hitAreaDefaults.lineWidth
              ? this.hitAreaDefaults.lineWidth
              : $height;
        }

        var $canvas = $(
          '<canvas width="' +
            $width +
            '" height="' +
            $height +
            '">Your browser does not support HTML5 Canvas.</canvas>'
        );

        $.canvas.object = $canvas[0].getContext("2d");

        if ($tooSmall) {
          // just create a rectangle of color...
          $.canvas.object.fillStyle = "#000";
          $.canvas.object.fillRect(0, 0, $width, $height);
        } else {
          this.setDefaults(true);
          this._drawshape($shape);
          console.log("3?");
        }

        $.canvas.object = $(".canvas:visible")[0].getContext("2d");

        // for now lets append it....

        return $canvas;
      },
      destroy: function () {
        $(".canvas:visible").off(
          "mousedown touchstart mousemove touchmove mouseup touchend mouseout, contextmenu"
        );
        $(".delete-item").off("click");
        $(".delete-item").off("touchstart");
        $(".clone-item").off("click");
        $(".clone-item").off("touchstart");
        $("#canvas-text").blur();
      },
    };
  })(jQuery);
}

setPitch();
function setPitch() {
  (function ($) {
    $.canvas.items.pitch = {
      current: "pitch_7",
      colour: "green1",
      defaults: {
        strokeStyle: "#ffffff",
        lineWidth: 6,
        lineJoin: "round",
      },
      setup: function () {
        //preload gradients...
        var img = new Image();
        img.id = "birdseye";
        img.src = $base.birdseye;
        img.onload = function () {
          $("#body").append(this);
          $(this).hide();
          $.canvas.reset();
        };

        var img = new Image();
        img.id = "gradient";
        img.src = $base.gradient;
        img.onload = function () {
          $("#body").append(this);
          $(this).hide();
          $.canvas.reset();
        };

        var img = new Image();
        img.id = "birdseye_grey";
        img.src = $base.birdseye_grey;
        img.onload = function () {
          $("#body").append(this);
          $(this).hide();
          $.canvas.reset();
        };

        var img = new Image();
        img.id = "gradient_grey";
        img.src = $base.gradient_grey;
        img.onload = function () {
          $("#body").append(this);
          $(this).hide();
          $.canvas.reset();
        };

        var img = new Image();
        img.id = "gradient_futsal";
        img.src = $base.gradient_futsal;
        img.onload = function () {
          $("#body").append(this);
          $(this).hide();
          $.canvas.reset();
        };

        // mouseover scroll...
        $("#pitch-navigation").on("mousemove touchmove", function (e) {
          if (
            e.type == "touchstart" ||
            e.type == "touchmove" ||
            e.type == "touchend" ||
            e.type == "touchcancel"
          ) {
            var touch =
              e.originalEvent.touches[0] || e.originalEvent.changedTouches[0];
            e.pageX = touch.pageX;
            e.pageY = touch.pageY;
          } else if (
            e.type == "mousedown" ||
            e.type == "mouseup" ||
            e.type == "mousemove" ||
            e.type == "mouseover" ||
            e.type == "mouseout" ||
            e.type == "mouseenter" ||
            e.type == "mouseleave"
          ) {
          }
          $.canvas.items.pitch.setScroll(e.pageX - $(this).offset().left);
        });
        $(window).on("resize resizeend", function (e) {
          var pos = $("#pitch-navigation").data("position");
          $.canvas.items.pitch.setScroll(pos);
        });
      },
      init: function () {
        $.canvas.items.pitch.draw($.canvas.items.pitch.current);
        $.canvas.copyrightImg();
      },
      setColour: function (colour) {
        set_default_lines_color_on_pitch(colour);
        this.colour = colour;
        var $currentObjects = $.canvas.history.currentObjects();
        if ($currentObjects.length) {
          // To set Grey color for 2d and 3d Goals when Pitch is off white color

          $.each($currentObjects, function (i, item) {
            //To get Grey color Goals
            var type = item.type.split("_");
            if (
              item.type.indexOf("goal_rotation_") !== -1 ||
              item.type.indexOf("standq_3d_") !== -1
            ) {
              // Code to set grey color goal for 3d goals on white pitch
              var img = new Image();
              img.width = item.cache.width;
              img.height = item.cache.height;
              if (item.type.indexOf("goal_rotation_") !== -1) {
                if (colour == "mono" || colour == "plane-white") {
                  var svg_url =
                    baseURL +
                    "/components/com_sessioncreatorv1/assets/rotated-goals/" +
                    type[2] +
                    "_grey.svg";
                } else {
                  var svg_url =
                    baseURL +
                    "/components/com_sessioncreatorv1/assets/rotated-goals/" +
                    type[2] +
                    ".svg";
                }
              } else if (item.type.indexOf("standq_3d_") !== -1) {
                if (colour == "mono" || colour == "plane-white") {
                  var svg_url =
                    baseURL +
                    "/components/com_sessioncreatorv1/assets/small-rotated-goals/" +
                    type[2] +
                    "_grey.svg";
                } else {
                  var svg_url =
                    baseURL +
                    "/components/com_sessioncreatorv1/assets/small-rotated-goals/" +
                    type[2] +
                    ".svg";
                }
              }
              img.src = svg_url;
              item.cache.img = img;
              img.onload = function () {
                $.canvas.reset();
              };
              $currentObjects[i].cache.img = img;
            } else if (
              item.type.indexOf("net_top_") !== -1 ||
              item.type.indexOf("standq_2d_") !== -1
            ) {
              // Code to set grey color goal for 2d goals on white pitch
              var img = new Image();
              img.width = item.cache.width;
              img.height = item.cache.height;
              if (item.type.indexOf("net_top_") !== -1) {
                if (colour == "mono" || colour == "plane-white") {
                  var svg_url =
                    baseURL +
                    "/components/com_sessioncreatorv1/assets/2d_big_goals/" +
                    type[2] +
                    "_grey.svg";
                } else {
                  var svg_url =
                    baseURL +
                    "/components/com_sessioncreatorv1/assets/2d_big_goals/" +
                    type[2] +
                    ".svg";
                }
              } else if (item.type.indexOf("standq_2d_") !== -1) {
                if (colour == "mono" || colour == "plane-white") {
                  var svg_url =
                    baseURL +
                    "/components/com_sessioncreatorv1/assets/2d_mini_goals/" +
                    type[2] +
                    "_grey.svg";
                } else {
                  var svg_url =
                    baseURL +
                    "/components/com_sessioncreatorv1/assets/2d_mini_goals/" +
                    type[2] +
                    ".svg";
                }
              }
              img.src = svg_url;
              item.cache.img = img;
              img.onload = function () {
                $.canvas.reset();
              };
              $currentObjects[i].cache.img = img;
            }
          });
          setTimeout(function () {
            $.canvas.history.doAutoSave();
          }, 200);
        }

        $.canvas.reset();
        // autoSave...
        $.canvas.history.doAutoSave();
      },

      setScroll: function (mousePosition) {
        var $this = $("#pitch-navigation");

        if (
          $this.width() >= $this.find(".navigation-content > ul").outerWidth()
        ) {
          $this
            .data("position", 0)
            .find(".navigation-content > ul")
            .css({ left: 0 });
          return;
        }

        var wrapperWidth = $this.width(),
          contentWidth =
            $this.find(".navigation-content > ul").outerWidth() - wrapperWidth,
          ratio = contentWidth / wrapperWidth,
          position = Math.round(mousePosition * ratio);

        // check max & mins
        if (mousePosition > wrapperWidth) {
          $this
            .data("position", mousePosition)
            .find(".navigation-content > ul")
            .stop()
            .animate({ left: contentWidth * -1 }, 300, "linear");
        } else if (mousePosition < 0) {
          $this
            .data("position", mousePosition)
            .find(".navigation-content > ul")
            .stop()
            .animate({ left: 0 }, 300, "linear");
        } else {
          $this
            .data("position", mousePosition)
            .find(".navigation-content > ul")
            .stop()
            .animate({ left: position * -1 }, 300, "linear");
        }
      },
      setDefaults: function () {
        $.each(this.defaults, function (i, item) {
          $.canvas.object[i] = item;
        });
      },
      set: function ($item) {
        if (this.current === $item) {
          return;
        }
        this.current = $item;
        var $currentObjects = $.canvas.history.currentObjects();
        if ($currentObjects.length) {
          // to change goal size based on pitch selection.
          $.each($currentObjects, function (i, equip_item) {
            var item_width = "",
              item_height = "";
            var size_arr = setGoalSize($item, equip_item.type, $.canvas.size);
            if (size_arr.width) {
              $currentObjects[i].cache.width = size_arr.width;
              $currentObjects[i].cache.height = size_arr.height;
            }
          });
        }
        $.canvas.reset();
        // autoSave...
        $.canvas.history.doAutoSave();
      },
      draw: function ($item) {
        var pitchID = $item.split("_")[1];

        img = new Image();

        var oldPitches = [
          "18",
          "19",
          "20",
          "21",
          "22",
          "23",
          "24",
          "25",
          "26",
          "27",
          "28",
          "29",
          "30",
          "31",
          "32",
          "33",
          "34",
          "35",
          "36",
          "37",
          "38",
          "39",
          "40",
          "41",
          "42",
          "43",
          "44",
          "45",
          "46",
          "47",
          "48",
          "49",
          "50",
        ];
        var newPitches = [
          "52",
          "53",
          "54",
          "55",
          "56",
          "57",
          "58",
          "59",
          "60",
          "61",
          "62",
          "63",
          "64",
          "65",
          "66",
          "67",
          "68",
          "95",
          "96",
          "97",
          "98",
          "99",
          "100",
          "101",
          "102",
          "103",
          "104",
          "105",
          "106",
          "107",
          "108",
          "109",
          "110",
          "111",
          "112",
          "113",
          "114",
          "115",
          "116",
          "117",
          "118",
          "119",
          "120",
          "121",
          "122",
          "94",
        ];

        switch ($.canvas.items.pitch.colour) {
          case "colour":
            if ($settings.template === "futsal") {
              // For 3D pitch background images
              if (pitchID === "3" || pitchID === "1") {
                $.canvas.object.beginPath();
                $.canvas.object.rect(
                  0,
                  0,
                  $.canvas.size.width,
                  $.canvas.size.height
                );
                $.canvas.object.fillStyle =
                  pitchID === "1" ? "#FF6525" : "#0066CC";
                $.canvas.object.fill();
              } else {
                var img = $("#gradient_futsal");
                if (img.length) {
                  $.canvas.object.drawImage(
                    img[0],
                    0,
                    0,
                    $.canvas.size.width,
                    $.canvas.size.height
                  );
                }
              }
            } else {
              // For 3D pitch background images
              if (newPitches.indexOf(pitchID) != -1) {
                var grediant_id = $("#gradient_3d_Green_Pitch1");
              } else if (oldPitches.indexOf(pitchID) != -1) {
                var grediant_id = $("#gradient_3d_Green_Pitch-old");
              } else {
                var grediant_id = $("#gradient");
              }
              var img =
                pitchID === "3" ? $("#gradient_pitch_app") : grediant_id;
              if (img.length) {
                $.canvas.object.drawImage(
                  img[0],
                  0,
                  0,
                  $.canvas.size.width,
                  $.canvas.size.height
                );
              }
            }
            break;

          case "twitter-blue":
            var img = $("#gradient_twitter_blue");
            // For 3D pitch background images
            if (newPitches.indexOf(pitchID) != -1) {
              var img = $("#gradient_3d_Blue_Pitch");
            } else if (oldPitches.indexOf(pitchID) != -1) {
              var grediant_id = $("#gradient_3d_Blue_Pitch-old");
            }
            if (img.length) {
              $.canvas.object.drawImage(
                img[0],
                0,
                0,
                $.canvas.size.width,
                $.canvas.size.height
              );
            }
            break;

          case "orange":
            var img = $("#gradient_orange");
            // For 3D pitch background images
            if (newPitches.indexOf(pitchID) != -1) {
              var img = $("#gradient_3d_Grey_Pitch");
            } else if (oldPitches.indexOf(pitchID) != -1) {
              var grediant_id = $("#gradient_3d_Grey_Pitch-old");
            }

            if (img.length) {
              //                                    console.log('orange');
              //                                    console.log($.canvas.size.width);
              //                                    console.log($.canvas.size.height);
              $.canvas.object.drawImage(
                img[0],
                0,
                0,
                $.canvas.size.width,
                $.canvas.size.height
              );
            }
            break;
          case "green1":
            var img = $("#gradient_green_withoutgrass");
            // For 3D pitch background images
            if (newPitches.indexOf(pitchID) != -1) {
              var img = $("#gradient_3d_Green_Pitch");
            } else if (oldPitches.indexOf(pitchID) != -1) {
              var grediant_id = $("#gradient_green_withoutgrass-old");
            }
            if (img.length) {
              //                                    console.log($.canvas.size.width);
              //                                    console.log($.canvas.size.height);
              $.canvas.object.drawImage(
                img[0],
                0,
                0,
                $.canvas.size.width,
                $.canvas.size.height
              );
            }
            break;
          case "plane-white":
            var img = $("#gradient_white_plain_pitch");
            // For 3D pitch background images
            if (newPitches.indexOf(pitchID) != -1) {
              var img = $("#gradient_white_plain_pitch");
            } else if (oldPitches.indexOf(pitchID) != -1) {
              var grediant_id = $("#gradient_white_plain_pitch-old");
            }

            if (img.length) {
              $.canvas.object.drawImage(
                img[0],
                0,
                0,
                $.canvas.size.width,
                $.canvas.size.height
              );
            }
            break;

          case "mono":
            var img = $("#gradient_black-white-bg");
            // For 3D pitch background images
            if (newPitches.indexOf(pitchID) != -1) {
              var img = $("#gradient_3d_White_Pitch");
            } else if (oldPitches.indexOf(pitchID) != -1) {
              var grediant_id = $("#gradient_3d_White_Pitch-old");
            }

            if (img.length) {
              $.canvas.object.drawImage(
                img[0],
                0,
                0,
                $.canvas.size.width,
                $.canvas.size.height
              );
            }
            break;
        }

        this.setDefaults();

        if (pitchID !== "1") {
          var svg = $("a#" + $item + " .svg-wrapper.white-lines")
            .html()
            .trim();

          if (this.colour == "mono" || this.colour == "plane-white") {
            svg = $("a#" + $item + " .svg-wrapper.black-lines")
              .html()
              .trim();
            $("body")
              .addClass("pitch-mono")
              .append('<div id="tmp-svg">' + svg + "</div>");
            svg = $("#tmp-svg").html().trim();
            $("#tmp-svg").remove();
          } else {
            $("body").append('<div id="tmp-svg">' + svg + "</div>");
            svg = $("#tmp-svg").html().trim();
            $("#tmp-svg").remove();
            $("body").removeClass("pitch-mono");
          }

          var visble_canvas_id = $(".canvas:visible").attr("id");
          console.log('canvg4')
          canvg(visble_canvas_id, svg, {
            ignoreMouse: true,
            ignoreAnimation: true,
            ignoreDimensions: true,
            ignoreClear: true,
            scaleWidth: $.canvas.size.width,
          });
        }

        if ($settings.show_watermark) {
          var watermark = $("#watermark_" + pitchID)[0];
          $.canvas.object.drawImage(
            watermark,
            0,
            0,
            $.canvas.size.width,
            $.canvas.size.height
          );
        }
      },
      destroy: function () {},
    };

    $.canvas.items.pitch.setup();
    $.canvas.reset();
  })(jQuery);
}
setAllItems();

function setAllItems() {
  (function ($) {
    $.canvas.items.drag_items = {
      defaults: {
        strokeStyle: "#ffffff",
        lineWidth: 6,
        lineJoin: "round",
        fillStyle: "rgba(0,0,0,0)",
      },
      isdashed: false,
      init_click: function () {
        $this = $.canvas.items.drag_items;
        delete $this.startPosition;
        delete $this.startY;
        delete $this.dragItemIndex;

        $.canvas.items.previousClass = null;
        $.canvas.items.previousBtn = null;

        // mousedown is lost when hovering from a drawing event and because it fires too late, so we trigger it manually through the canvas.item. The event is for when users clcik the drag items button
        $(".canvas:visible").on("mousedown touchstart", function (e) {
          console.log("hello mosuedown event 3");

          $("#item-right-section").hide();
          $("#item-right-section-paste").hide();
          is_Collision = $isCollision = $.canvas.items.detectCollision(e);
          if (!$isCollision) {
            if (JSON.stringify(copy_object) != "{}") {
              if (
                e.type == "touchstart" ||
                e.type == "touchmove" ||
                e.type == "touchend" ||
                e.type == "touchcancel"
              ) {
                var touch =
                  e.originalEvent.touches[0] ||
                  e.originalEvent.changedTouches[0];
                e.offsetX = touch.pageX - touch.target.offsetLeft;
                e.offsetY = touch.pageY - touch.target.offsetTop;
              }
              if (e.button == 0 || e.type == "touchstart") {
                if (
                  !copy_object.lines_color &&
                  copy_object.type != "textarea"
                ) {
                  copy_object.endX = e.offsetX;
                  copy_object.endY = e.offsetY;
                  copy_object.cache.left =
                    copy_object.endX - copy_object.cache.width / 2;
                  copy_object.cache.right =
                    copy_object.endX + copy_object.cache.width / 2;
                  copy_object.cache.top =
                    copy_object.endY - copy_object.cache.height / 2;
                  copy_object.cache.bottom =
                    copy_object.endY + copy_object.cache.height / 2;
                  var item_type = copy_object.type;
                  var $copy_item = $("#" + item_type).get(0);
                  $.canvas.items.set($copy_item, item_type, null, e);
                  $.canvas.draggable.onEnd(e);
                } else {
                  // for lines, shapes cloning
                  var copied_object = $.extend(true, {}, copy_object);
                  var current_objects = $.canvas.history.currentObjects();
                  var count = current_objects.length;
                  copied_object.endX =
                    e.offsetX + (copy_object.endX - copy_object.startX);
                  copied_object.endY =
                    e.offsetY + (copy_object.endY - copy_object.startY);
                  copied_object.startX = e.offsetX;
                  copied_object.startY = e.offsetY;
                  var flashImport = false;
                  $.importer.setItem(
                    copied_object,
                    flashImport,
                    $(".canvas:visible").attr("id"),
                    count + 1
                  );
                  $.canvas.history.append(copied_object);
                  current_objects = $.extend(
                    true,
                    [],
                    $.canvas.history.currentObjects()
                  );
                  setTimeout(function () {
                    $.canvas.history.doAutoSave();
                    $.canvas.reset();
                  }, 200);
                }
                return;
              }
            } else {
              return;
            }
          } else {
            $(".canvas:visible").addClass("move");
            $.canvas.items.drag_items.hoverCheck = true;
            $.canvas.items.drag_items.dragItemIndex = $isCollision.id;
            $.canvas.items.drag_items.onStart(e);
            get_Collision = $.canvas.items.getCollision(e);
          }
        });

        $(".canvas:visible").on("contextmenu", function (e) {
          console.log("hello mosuedown event 34");
          is_Collision = $isCollision = $.canvas.items.detectCollision(e);
          get_Collision = $.canvas.items.getCollision(e);
          check_right_click_popup = 1;
          var item_name = $currentObjects[is_Collision.id].type;

          if (
            item_name == "football" ||
            item_name == "ladder_2d" ||
            item_name == "tyre" ||
            item_name.indexOf("net_top_") !== -1 ||
            item_name.indexOf("standq_2d_") !== -1 ||
            item_name.indexOf("goal_rotation_") !== -1 ||
            item_name.indexOf("standq_3d_") !== -1 ||
            item_name == "tyre_3d" ||
            item_name == "flag_3d" ||
            item_name == "BL2" ||
            item_name == "ladder" ||
            $currentObjects[is_Collision.id].lines_color
          ) {
            $("#item-color").css("display", "none");
          } else {
            $("#item-color").css("display", "block");
          }

          //To remove clockwise button from right click of goals
          if (
            item_name.indexOf("net_top_") !== -1 ||
            item_name.indexOf("standq_2d_") !== -1 ||
            item_name.indexOf("goal_rotation_") !== -1 ||
            item_name.indexOf("standq_3d_") !== -1
          ) {
            $("#clockwise").parent("p").css("display", "block");
          } else {
            $("#clockwise").parent("p").css("display", "none");
          }
          // To Keep&remove Name and 00 buttons from Right click of Players and Discs
          if (
            item_name.indexOf("player_circle") !== -1 ||
            item_name.indexOf("player_male") !== -1
          ) {
            $("#right-number").parent("p").css("display", "block");
            $("#above-name").parent("p").css("display", "block");
            $("#above-comment").parent("p").css("display", "block");
          } else {
            $("#right-number").parent("p").css("display", "none");
            $("#above-name").parent("p").css("display", "none");
            $("#above-comment").parent("p").css("display", "none");
          }
          if (!$isCollision) {
            return;
          } else {
            if (navigator.userAgent.indexOf("Firefox") > 0) {
              var offsetX = e.offsetX - 20;
              var offsetY = e.offsetY + 36;
            } else {
              var offsetX = e.offsetX - 20;
              var offsetY = e.offsetY + 36;
            }
            $("#item-right-section").show();
            $("#item-right-section")
              .offset({ top: offsetY, left: offsetX })
              .show();
            return false;
          }
          $(".canvas:visible").addClass("move");
          $.canvas.items.drag_items.hoverCheck = true;
          $.canvas.items.drag_items.dragItemIndex = $isCollision.id;
          $.canvas.items.drag_items.onStart(e);
        });
        // call on touch devices
        $(".canvas:visible")
          .on("touchstart", function (e) {
            $(this).data("lastPressed", new Date().getTime());
          })
          .on("touchend", function (e) {
            var lastPressed = $(this).data("lastPressed");
            if (lastPressed) {
              var duration = new Date().getTime() - lastPressed;
              $(this).data("lastPressed", false);
              if (duration > 500) {
                is_Collision = $isCollision = $.canvas.items.detectCollision(e);
                get_Collision = $.canvas.items.getCollision(e);

                var item_name = $currentObjects[is_Collision.id].type;

                if (
                  item_name == "football" ||
                  item_name == "ladder_2d" ||
                  item_name == "tyre" ||
                  item_name.indexOf("net_top_") !== -1 ||
                  item_name.indexOf("standq_2d_") !== -1 ||
                  item_name.indexOf("goal_rotation_") !== -1 ||
                  item_name.indexOf("standq_3d_") !== -1 ||
                  item_name == "tyre_3d" ||
                  item_name == "flag_3d" ||
                  item_name == "BL2" ||
                  item_name == "ladder" ||
                  $currentObjects[is_Collision.id].lines_color
                ) {
                  $("#item-color").css("display", "none");
                } else {
                  $("#item-color").css("display", "block");
                }
                if (item_name == "textarea") {
                  $(".clone-item").parent("p").css("display", "none");
                } else {
                  $(".clone-item").parent("p").css("display", "block");
                }
                //To remove clockwise button from right click of goals
                if (
                  item_name.indexOf("net_top_") !== -1 ||
                  item_name.indexOf("standq_2d_") !== -1 ||
                  item_name.indexOf("goal_rotation_") !== -1 ||
                  item_name.indexOf("standq_3d_") !== -1 ||
                  item_name.indexOf("box_D2_") !== -1
                ) {
                  $("#clockwise").parent("p").css("display", "block");
                } else {
                  $("#clockwise").parent("p").css("display", "none");
                }

                // To Keep&remove Name and 00 buttons from Right click of Players and Discs
                if (
                  item_name.indexOf("player_circle") !== -1 ||
                  item_name.indexOf("player_male") !== -1
                ) {
                  $("#right-number").parent("p").css("display", "block");
                  $("#above-name").parent("p").css("display", "block");
                  $("#above-comment").parent("p").css("display", "block");
                } else {
                  $("#right-number").parent("p").css("display", "none");
                  $("#above-name").parent("p").css("display", "none");
                  $("#above-comment").parent("p").css("display", "none");
                }
                if (!$isCollision) {
                  return;
                } else {
                  var touch =
                    e.originalEvent.touches[0] ||
                    e.originalEvent.changedTouches[0];
                  e.offsetX = touch.pageX - touch.target.offsetLeft;
                  e.offsetY = touch.pageY - touch.target.offsetTop;

                  if (navigator.userAgent.indexOf("Firefox") > 0) {
                    var offsetX = e.offsetX;
                    var offsetY = e.offsetY;
                  } else {
                    var offsetX = e.offsetX;
                    var offsetY = e.offsetY;
                  }
                  $("#item-right-section").show();
                  $("#item-right-section")
                    .offset({ top: offsetY, left: offsetX })
                    .show();
                  return false;
                }
                $(".canvas:visible").addClass("move");
                $.canvas.items.drag_items.hoverCheck = true;
                $.canvas.items.drag_items.dragItemIndex = $isCollision.id;
                $.canvas.items.drag_items.onStart(e);
              } else {
              }
            }
          })
          .mouseout(function () {
            $(this).data("lastPressed", false);
          });
        $(".delete-item").on("click touchstart", function (e) {
          copy_object = {};
          if (is_Collision) {
            var dragItemIndex = is_Collision.id;
            $.canvas.history.remove(dragItemIndex);
            $.canvas.reset();

            // autoSave...
            $.canvas.history.doAutoSave();
            $("#item-right-section").hide();
            redo_objects = [];
          }
        });

        $(".clone-item").on("click touchstart", function (e) {
          if (is_Collision) {
            var $currentObjects = $.canvas.history.currentObjects();
            var dragItemIndex = is_Collision.id;
            copy_object = $.extend(true, [], $currentObjects[is_Collision.id]);
            $("#item-right-section").hide();
            redo_objects = [];
          }
        });

        $("body").on("mousemove touchmove", function (e) {
          if (
            e.target.id != "va-accordion" &&
            !$(e.target).hasClass("sort-links")
          ) {
            $(".canvas:visible").removeClass("move");
            if ($.canvas.items.detectCollision(e)) {
              $(".canvas:visible").addClass("move");
            }
            $.canvas.items.drag_items.onDefaultMove(e);
          }
        });
        $("body").on("mouseup touchend", function (e) {
          if (
            e.target.id != "va-accordion" &&
            !$(e.target).hasClass("sort-links") &&
            !$(e.target).hasClass("practices_infomation") &&
            !$(e.target).hasClass("is_required") &&
            !$(e.target).hasClass("text-anchor") &&
            !$(e.target).hasClass("color_red") &&
            !$(e.target).hasClass("color_light_blue") &&
            !$(e.target).hasClass("text-tools-colors") &&
            !$(e.target).hasClass("shapes_color") &&
            !$(e.target).hasClass("notes-type") &&
            !$(e.target).hasClass("notes-type-anchor") &&
            !$(e.target).hasClass("main_practice_notes") &&
            !$(e.target).hasClass("inner-practice-canvas") &&
            !$(e.target).hasClass("practice-content")
          ) {
            $.canvas.items.drag_items.onEnd(e);
          }
        });
      },
      init: function () {
        $this = this;
        delete $this.startPosition;
        delete $this.startY;

        $("body").on("mousemove touchmove", function (e) {
          $this.onMove(e);
        });
        $("body").on("mouseup touchend", function (e) {
          $this.onEnd(e);
        });
      },
      onStart: function (e) {
        e.stopPropagation();
        e.preventDefault();

        $("#canvas-text").blur();

        $("#startDrag,#centerDrag,#endDrag").remove();
        var $objects = $.canvas.history.currentObjects();
        $.each($objects, function (i, item) {
          delete item.hasVisibleMarkers;
        });

        var type = $objects[$.canvas.items.drag_items.dragItemIndex].type;
        if (
          type === "movementline" ||
          type === "movementline_opposition" ||
          type == "movementlinedotted_opposition"
        ) {
          // draw markers & track movements...
          $.canvas.items[type].drawMarkers(
            $objects[$.canvas.items.drag_items.dragItemIndex]
          );
          log("draw markers");
        }

        //duplicate current objects and push to history...
        var $objects = $.extend(true, [], $.canvas.history.currentObjects());
        $.canvas.history.appendAll($objects);
        this.startPosition = $.canvas.getOffset(e);
        this.isDown = true;
      },
      onEnd: function (e) {
        e.stopPropagation();
        e.preventDefault();

        if (!this.isDown) {
          return;
        }

        if (this.hoverCheck && $.canvas.items.previousClass) {
          $.canvas.items.set(
            $.canvas.items.previousBtn,
            $.canvas.items.previousClass
          );
          $(".canvas:visible").removeClass("move");
        }
        if (
          e.type == "touchstart" ||
          e.type == "touchmove" ||
          e.type == "touchend" ||
          e.type == "touchcancel"
        ) {
          var touch =
            e.originalEvent.touches[0] || e.originalEvent.changedTouches[0];
          e.pageX = touch.pageX;
          e.pageY = touch.pageY;
        } else if (
          e.type == "mousedown" ||
          e.type == "mouseup" ||
          e.type == "mousemove" ||
          e.type == "mouseover" ||
          e.type == "mouseout" ||
          e.type == "mouseenter" ||
          e.type == "mouseleave"
        ) {
        }
        var $objects = $.canvas.history.currentObjects();
        // added temporarily check for issue after dwawing base items
        if (!$objects[$.canvas.items.drag_items.dragItemIndex]) {
          return false;
        }
        var type = $objects[$.canvas.items.drag_items.dragItemIndex].type;
        if (type === "movementline" || type === "movementline_opposition") {
          // draw markers & track movements...
          $.canvas.items[type].drawMarkers(
            $objects[$.canvas.items.drag_items.dragItemIndex]
          );
        }

        //if object was moved outside of canvas - delete it from the history
        var canvasOffset = $(".canvas:visible").offset();
        if (
          !(
            e.pageX >= canvasOffset.left &&
            e.pageY >= canvasOffset.top &&
            e.pageX <= canvasOffset.left + $(".canvas:visible").width() &&
            e.pageY <= canvasOffset.top + $(".canvas:visible").height()
          )
        ) {
          $.canvas.history.remove(this.dragItemIndex);
          $.canvas.reset();

          // autoSave...
          $.canvas.history.doAutoSave();
        } else {
          //if object did not move - delete it from the history
          if (this.dragItemIndex >= 0 && !this.hasChangedPosition) {
            $.canvas.history.doUndo();
          } else {
            // autoSave...
            $.canvas.history.doAutoSave();
          }
        }

        this.hoverCheck = this.isDown = this.hasChangedPosition = this.isEditingShape = false;

        $("#trash").removeClass("active");
      },
      onDefaultMove: function (e) {
        e.stopPropagation();
        e.preventDefault();

        if (!this.isDown) {
          return;
        }
        // added temporarily check for issue after drawing base items
        if (!this.startPosition) {
          return false;
        }
        var mousePosition = $.canvas.getOffset(e);
        var startPosition = this.startPosition;

        var changedBy = {
          x: mousePosition.x - startPosition.x,
          y: mousePosition.y - startPosition.y,
        };
        var $objects = $.canvas.history.currentObjects();

        // update the history array object with new coords...
        $.canvas.items[$objects[this.dragItemIndex].type].updatePosition(
          $objects[this.dragItemIndex],
          changedBy
        );

        if (changedBy.x != 0 || changedBy.y != 0) {
          this.hasChangedPosition = true;
        }

        $.canvas.reset();
        this.startPosition = mousePosition;
      },
      onMove: function (e) {
        e.stopPropagation();
        e.preventDefault();
        if (
          e.type == "touchstart" ||
          e.type == "touchmove" ||
          e.type == "touchend" ||
          e.type == "touchcancel"
        ) {
          var touch =
            e.originalEvent.touches[0] || e.originalEvent.changedTouches[0];
          e.pageX = touch.pageX;
          e.pageY = touch.pageY;
        } else if (
          e.type == "mousedown" ||
          e.type == "mouseup" ||
          e.type == "mousemove" ||
          e.type == "mouseover" ||
          e.type == "mouseout" ||
          e.type == "mouseenter" ||
          e.type == "mouseleave"
        ) {
        }
        if (this.isDown && this.isEditingShape) {
          log("change shape");
          return;
        }

        if (!this.isDown && !$.canvas.items.detectCollision(e)) {
          $(".canvas:visible").removeClass("move");
          return;
        }

        $(".canvas:visible").addClass("move");
        this.onDefaultMove(e);
      },
      destroy: function () {
        $(".canvas:visible").off(
          "mousedown touchstart mousemove touchmove mouseup  touchend mouseout, contextmenu"
        );
        $("body").off("mousemove touchmove mouseup touchend");
        $(".delete-item").off("click");
        $(".delete-item").off("touchstart");
        $(".clone-item").off("click");
        $(".clone-item").off("touchstart");
      },
    };
  })(jQuery);
  (function ($) {
    $.canvas.items.basicline = $.extend(true, {}, $.canvas.items.base);
  })(jQuery);
  (function ($) {
    $.canvas.items.pass = $.extend(true, {}, $.canvas.items.base);
    $.canvas.items.pass._drawshape = function ($item) {
      console.log("4?")
      var endX = calculateRevX($item.x_percent) || $item.endX;
      var endY = calculateRevY($item.y_percent) || $item.endY;
      var startX = calculateRevX($item.x_start_percent) || $item.startX;
      var startY = calculateRevY($item.y_start_percent) || $item.startY;
      $.canvas.object.beginPath();
      $.canvas.object.moveTo(startX, startY);
      $.canvas.object.lineTo(endX, endY);
      $.canvas.object.lineWidth = 2;

      if ($item.lines_color) {
        $.canvas.object.strokeStyle = $item.lines_color;
      }
      $.canvas.object.stroke();
      $.canvas.object.closePath();
      // Add Arrow...
      $.canvas.items.applyArrow(
        startX,
        startY,
        endX,
        endY
      );
    };
  })(jQuery);
  (function ($) {
    $.canvas.items.darkline = $.extend(true, {}, $.canvas.items.base);
    $.canvas.items.darkline._drawshape = function ($item) {
      console.log("5?");
      var endX = calculateRevX($item.x_percent) || $item.endX;
      var endY = calculateRevY($item.y_percent) || $item.endY;
      var startX = calculateRevX($item.x_start_percent) || $item.startX;
      var startY = calculateRevY($item.y_start_percent) || $item.startY;
      var centerX = calculateRevX($item.x_center_percent) || $item.centerX;
      var centerY = calculateRevY($item.y_center_percent) || $item.centerY;
      $.canvas.object.beginPath();
      $.canvas.object.moveTo(startX, startY);
      $.canvas.object.lineTo(endX, endY);
      $.canvas.object.lineWidth = 2;
      if ($item.lines_color) {
        $.canvas.object.strokeStyle = $item.lines_color;
      }
      $.canvas.object.stroke();
      $.canvas.object.closePath();
      $.canvas.object.setLineDash([]);
    };
  })(jQuery);

  //function to draw third line having name pass movementline movement tool dot on head

  (function ($) {
    $.canvas.items.dot = $.extend(true, {}, $.canvas.items.base);
    $.canvas.items.dot._drawshape = function ($item) {
      console.log("6?");
      var endX = calculateRevX($item.x_percent) || $item.endX;
      var endY = calculateRevY($item.y_percent) || $item.endY;
      var startX = calculateRevX($item.x_start_percent) || $item.startX;
      var startY = calculateRevY($item.y_start_percent) || $item.startY;
      var centerX = calculateRevX($item.x_center_percent) || $item.centerX;
      var centerY = calculateRevY($item.y_center_percent) || $item.centerY;
      $.canvas.object.beginPath();
      $.canvas.object.moveTo(startX, startY);
      $.canvas.object.lineTo(endX, endY);
      $.canvas.object.lineWidth = 2;
      if ($item.lines_color) {
        $.canvas.object.strokeStyle = $item.lines_color;
      }
      $.canvas.object.stroke();
      $.canvas.object.closePath();

      // Add Arrow...
      $.canvas.items.applyDot(
        startX,
        startY,
        endX,
        endY,
        $item.lines_color
      );
    };
  })(jQuery);

  (function ($) {
    $.canvas.items.running = $.extend(true, {}, $.canvas.items.base);
    $.canvas.items.running.defaults = {
      strokeStyle: "#000",
    };
    $.canvas.items.running.isdotted = true;

    $.canvas.items.running.drawMarkers = function ($item, ignoreInteractions) {
      var $this = this;

      if (!ignoreInteractions) {
        this.setDefaults();
        $item.hasVisibleMarkers = true;
        $("#startDrag,#centerDrag,#endDrag").remove();
      }

      // add padding...
      var zoomBy = 1 + $.canvas.zoomTracking / 10,
        padding = parseFloat($("body").css("font-size").replace("px", "")),
        startX = ($item.startX / $.canvas.scaledRatio) * zoomBy + padding,
        startY = ($item.startY / $.canvas.scaledRatio) * zoomBy + padding,
        centerX = ($item.centerX / $.canvas.scaledRatio) * zoomBy + padding,
        centerY = ($item.centerY / $.canvas.scaledRatio) * zoomBy + padding,
        endX = ($item.endX / $.canvas.scaledRatio) * zoomBy + padding,
        endY = ($item.endY / $.canvas.scaledRatio) * zoomBy + padding,
        $currentObjects = $.canvas.history.currentObjects(),
        $objectID = $currentObjects.indexOf($item);

      $("#startDrag")
        .data("objectID", $objectID)
        .css({ top: startY, left: startX });
      $("#centerDrag")
        .data("objectID", $objectID)
        .css({ top: centerY, left: centerX });
      $("#endDrag").data("objectID", $objectID).css({ top: endY, left: endX });

      if (!ignoreInteractions) {
        $("#startDrag,#centerDrag,#endDrag").on(
          "mousedown touchstart",
          function (e) {
            e.stopPropagation();
            e.preventDefault();
            $(".canvas:visible").addClass("move");
            $this.isShapeChangeDown = true;
            $this.shapeStartPosition = $.canvas.getOffset(e);
            $this.shapeIndex = $(this).data("objectID");
            $this.shapePoint = $(this).attr("id").split("Drag")[0];

            //duplicate current objects and push to history...
            var $objects = $.extend(
              true,
              [],
              $.canvas.history.currentObjects()
            );
            $.canvas.history.appendAll($objects);

            log("shape changing - START");
            log($(this).data("objectID"));
          }
        );

        $(".canvas:visible,#startDrag,#centerDrag,#endDrag").on(
          "mousemove touchmove",
          function (e) {
            if (!$this.isShapeChangeDown) {
              return;
            }

            // calculate change...
            var mousePosition = $.canvas.getOffset(e);
            var changedBy = {
              x: mousePosition.x - $this.shapeStartPosition.x,
              y: mousePosition.y - $this.shapeStartPosition.y,
            };

            var $objects = $.canvas.history.currentObjects();

            // update the history array object with new coords...
            $objects[$this.shapeIndex][$this.shapePoint + "X"] += changedBy.x;
            $objects[$this.shapeIndex][$this.shapePoint + "Y"] += changedBy.y;

            $.canvas.items[$objects[$this.shapeIndex].type].drawMarkers(
              $objects[$this.shapeIndex],
              true
            );

            if (changedBy.x != 0 || changedBy.y != 0) {
              $this.shapeHasChangedPosition = true;
            }

            //$.canvas.reset();
            $this.shapeStartPosition = mousePosition;
            log("shape changing");
          }
        );
        $(".canvas:visible,#startDrag,#centerDrag,#endDrag").on(
          "mouseup touchend",
          function (e) {
            if (!$this.isShapeChangeDown) {
              return;
            }

            if ($this.shapeIndex >= 0 && !$this.shapeHasChangedPosition) {
              $.canvas.history.doUndo();
            }

            var $objects = $.canvas.history.currentObjects();

            $objects[$this.shapeIndex].cache = $.canvas.items[
              $objects[$this.shapeIndex].type
            ].setCache($objects[$this.shapeIndex]);
            $objects[$this.shapeIndex].hitarea = $.canvas.items[
              $objects[$this.shapeIndex].type
            ].drawHitArea($objects[$this.shapeIndex]);

            $this.isShapeChangeDown = false;
            $.canvas.reset();
            log("shape changing - END");
          }
        );
      }
    };
    $.canvas.items.running.onStart = function (e) {
      e.stopPropagation();
      e.preventDefault();
      $("#canvas-text").blur();

      if (this.isCollision(e, true)) {
        return;
      }

      $("#startDrag,#centerDrag,#endDrag").remove();
      var $objects = $.canvas.history.currentObjects();
      $.each($objects, function (i, item) {
        delete item.hasVisibleMarkers;
      });

      if (!$.canvas.items.current.drawCurve) {
        var mousePosition = $.canvas.getOffset(e);
        $.canvas.items.current.startX = mousePosition.x;
        $.canvas.items.current.startY = mousePosition.y;
        $.canvas.items.current.lines_color = $(".color_light_blue").css(
          "backgroundColor"
        );
        $.canvas.items.current.isDown = true;
      }
    };
    $.canvas.items.running.onEnd = function (e) {
      e.stopPropagation();
      e.preventDefault();

      if (!$.canvas.items.current.drawCurve) {
        $.canvas.items.current.drawCurve = true;
      } else {
        $.canvas.items.render($.canvas.items.current.type);
      }
    };
    $.canvas.items.running.onMove = function (e) {
      e.stopPropagation();
      e.preventDefault();

      $(".canvas:visible").removeClass("move");
      if (this.isCollision(e)) {
        return;
      }

      if (!$.canvas.items.current.isDown) {
        return;
      }

      var mousePosition = $.canvas.getOffset(e);
      if (!$.canvas.items.current.drawCurve) {
        $.canvas.items.current.endX = $.canvas.items.current.centerX =
          mousePosition.x;
        $.canvas.items.current.endY = $.canvas.items.current.centerY =
          mousePosition.y;
      } else {
        $.canvas.items.current.centerX = mousePosition.x;
        $.canvas.items.current.centerY = mousePosition.y;
      }
      $.canvas.reset();
    };
    $.canvas.items.running.getCoords = function ($item) {
      var left = $item.startX,
        right = $item.endX,
        top = $item.startY,
        bottom = $item.endY;

      //flipped horz...
      if (left > right) {
        right = left;
        left = $item.endX;
      }

      //flipped vert...
      if (top > bottom) {
        bottom = top;
        top = $item.endY;
      }

      // Get furthest poinst...
      if ($item.centerX < left) {
        left = $item.centerX;
      }
      if ($item.centerX > right) {
        right = $item.centerX;
      }
      if ($item.centerY < top) {
        top = $item.centerY;
      }
      if ($item.centerY > bottom) {
        bottom = $item.centerY;
      }
      return { left: left, right: right, top: top, bottom: bottom };
    };
    $.canvas.items.running.drawHitArea = function ($item) {
      $shape = $.extend(true, {}, $item);

      //top left -> bottom right
      if ($item.startX <= $item.endX && $item.startY <= $item.endY) {
        log("top left -> bottom right");
        var left = $item.startX,
          right = $item.endX,
          top = $item.startY,
          bottom = $item.endY;

        var $org_width = right - left,
          $org_height = bottom - top;

        // Get furthest poinst...
        if ($item.centerX < left) {
          left = $item.centerX;
        }
        if ($item.centerX > right) {
          right = $item.centerX;
        }
        if ($item.centerY < top) {
          top = $item.centerY;
        }
        if ($item.centerY > bottom) {
          bottom = $item.centerY;
        }

        var $width = right - left,
          $height = bottom - top;

        $shape.startX = 0;
        $shape.endX = $item.endX - $item.startX;

        $shape.startY = 0;
        $shape.endY = $item.endY - $item.startY;

        $shape.centerX = $item.centerX - $item.startX;
        $shape.centerY = $item.centerY - $item.startY;

        if ($item.startX > $item.centerX) {
          $shape.startX += $width - $org_width;
          $shape.centerX += $width - $org_width;
          $shape.endX += $width - $org_width;
        }
        if ($item.startY > $item.centerY) {
          $shape.startY += $height - $org_height;
          $shape.centerY += $height - $org_height;
          $shape.endY += $height - $org_height;
        }

        //top right -> bottom left
      } else if ($item.startX >= $item.endX && $item.startY <= $item.endY) {
        log("top right -> bottom left");
        var left = $item.endX,
          right = $item.startX,
          top = $item.startY,
          bottom = $item.endY;

        var $org_width = right - left,
          $org_height = bottom - top;

        // Get furthest poinst...
        if ($item.centerX < left) {
          left = $item.centerX;
        }
        if ($item.centerX > right) {
          right = $item.centerX;
        }
        if ($item.centerY < top) {
          top = $item.centerY;
        }
        if ($item.centerY > bottom) {
          bottom = $item.centerY;
        }

        var $width = right - left,
          $height = bottom - top;

        $shape.startX = $item.startX - $item.endX;
        $shape.endX = 0;

        $shape.startY = 0;
        $shape.endY = $item.endY - $item.startY;

        $shape.centerX = $item.centerX - $item.endX;
        $shape.centerY = $item.centerY - $item.startY;

        if ($item.endX > $item.centerX) {
          $shape.startX += $width - $org_width;
          $shape.centerX += $width - $org_width;
          $shape.endX += $width - $org_width;
        }
        if ($item.endY > $item.centerY) {
          $shape.startY += $height - $org_height;
          $shape.centerY += $height - $org_height;
          $shape.endY += $height - $org_height;
        }

        //bottom left -> top right
      } else if ($item.startX <= $item.endX && $item.startY >= $item.endY) {
        log("bottom left -> top right");
        var left = $item.startX,
          right = $item.endX,
          top = $item.endY,
          bottom = $item.startY;

        var $org_width = right - left,
          $org_height = bottom - top;

        // Get furthest poinst...
        if ($item.centerX < left) {
          left = $item.centerX;
        }
        if ($item.centerX > right) {
          right = $item.centerX;
        }
        if ($item.centerY < top) {
          top = $item.centerY;
        }
        if ($item.centerY > bottom) {
          bottom = $item.centerY;
        }

        var $width = right - left,
          $height = bottom - top;

        $shape.startX = 0;
        $shape.endX = $item.endX - $item.startX;

        $shape.startY = $item.startY - $item.endY;
        $shape.endY = 0;

        $shape.centerX = $item.centerX - $item.startX;
        $shape.centerY = $item.centerY - $item.endY;

        if ($item.startX > $item.centerX) {
          $shape.startX += $width - $org_width;
          $shape.centerX += $width - $org_width;
          $shape.endX += $width - $org_width;
        }
        if ($item.endY > $item.centerY) {
          $shape.startY += $height - $org_height;
          $shape.centerY += $height - $org_height;
          $shape.endY += $height - $org_height;
        }
      } else if ($item.startX >= $item.endX && $item.startY >= $item.endY) {
        log("bottom right -> top left");
        var left = $item.endX,
          right = $item.startX,
          top = $item.endY,
          bottom = $item.startY;

        var $org_width = right - left,
          $org_height = bottom - top;

        // Get furthest poinst...
        if ($item.centerX < left) {
          left = $item.centerX;
        }
        if ($item.centerX > right) {
          right = $item.centerX;
        }
        if ($item.centerY < top) {
          top = $item.centerY;
        }
        if ($item.centerY > bottom) {
          bottom = $item.centerY;
        }

        var $width = right - left,
          $height = bottom - top;

        $shape.startX = $item.startX - $item.endX;
        $shape.endX = 0;

        $shape.startY = $item.startY - $item.endY;
        $shape.endY = 0;

        $shape.centerX = $item.centerX - $item.endX;
        $shape.centerY = $item.centerY - $item.endY;

        if ($item.endX > $item.centerX) {
          $shape.startX += $width - $org_width;
          $shape.centerX += $width - $org_width;
          $shape.endX += $width - $org_width;
        }
        if ($item.endY > $item.centerY) {
          $shape.startY += $height - $org_height;
          $shape.centerY += $height - $org_height;
          $shape.endY += $height - $org_height;
        }
      }

      $height =
        $height < this.hitAreaDefaults.lineWidth
          ? this.hitAreaDefaults.lineWidth
          : $height;
      $width =
        $width < this.hitAreaDefaults.lineWidth
          ? this.hitAreaDefaults.lineWidth
          : $width;

      var $canvas = $(
        '<canvas style="background:aqua; position:absolute; top:0; left:0;" width="' +
          $width +
          '" height="' +
          $height +
          '">Your browser does not support HTML5 Canvas.</canvas>'
      );

      $.canvas.object = $canvas[0].getContext("2d");

      this.setDefaults(true);
      this._drawshape($shape);
      console.log("7?");
      $.canvas.object = $(".canvas:visible")[0].getContext("2d");

      // for now lets append it....
      return $canvas;
    };
    $.canvas.items.running._drawshape = function ($item) {
      console.log("8?");
      $.canvas.object.beginPath();
      $.canvas.object.moveTo($item.startX, $item.startY);
      $.canvas.object.quadraticCurveTo(
        $item.centerX,
        $item.centerY,
        $item.endX,
        $item.endY
      );
      $.canvas.object.lineWidth = 2;
      if ($item.lines_color) {
        $.canvas.object.strokeStyle = $item.lines_color;
      }
      $.canvas.object.stroke();
      $.canvas.object.closePath();

      // Add Arrow...
      if (
        !$item.drawCurve ||
        ($item.endX === $item.centerX && $item.endY === $item.centerY)
      ) {
        $.canvas.items.applyArrow(
          $item.startX,
          $item.startY,
          $item.endX,
          $item.endY
        );
      } else {
        $.canvas.items.applyArrow(
          $item.centerX,
          $item.centerY,
          $item.endX,
          $item.endY
        );
      }
    };
  })(jQuery);

  // function to draw simple dotted line having arrow on head(2nd line)
  (function ($) {
    $.canvas.items.movementline = $.extend(true, {}, $.canvas.items.base);
    //$.canvas.items.movementline.isdashed = true;

    $.canvas.items.movementline.drawMarkers = function (
      $item,
      ignoreInteractions
    ) {
      var $this = this;

      if (!ignoreInteractions) {
        this.setDefaults();
        $item.hasVisibleMarkers = true;
        $("#startDrag,#centerDrag,#endDrag").remove();
      }

      // add padding...
      var zoomBy = 1 + $.canvas.zoomTracking / 10,
        padding = parseFloat($("body").css("font-size").replace("px", "")),
        startX = ($item.startX / $.canvas.scaledRatio) * zoomBy + padding,
        startY = ($item.startY / $.canvas.scaledRatio) * zoomBy + padding,
        centerX = ($item.centerX / $.canvas.scaledRatio) * zoomBy + padding,
        centerY = ($item.centerY / $.canvas.scaledRatio) * zoomBy + padding,
        endX = ($item.endX / $.canvas.scaledRatio) * zoomBy + padding,
        endY = ($item.endY / $.canvas.scaledRatio) * zoomBy + padding,
        $currentObjects = $.canvas.history.currentObjects(),
        $objectID = $currentObjects.indexOf($item);

      $("#startDrag")
        .data("objectID", $objectID)
        .css({ top: startY, left: startX });
      $("#centerDrag")
        .data("objectID", $objectID)
        .css({ top: centerY, left: centerX });
      $("#endDrag").data("objectID", $objectID).css({ top: endY, left: endX });

      if (!ignoreInteractions) {
        $("#startDrag,#centerDrag,#endDrag").on(
          "mousedown touchstart",
          function (e) {
            e.stopPropagation();
            e.preventDefault();
            $(".canvas:visible").addClass("move");
            $this.isShapeChangeDown = true;
            $this.shapeStartPosition = $.canvas.getOffset(e);
            $this.shapeIndex = $(this).data("objectID");
            $this.shapePoint = $(this).attr("id").split("Drag")[0];

            //duplicate current objects and push to history...
            var $objects = $.extend(
              true,
              [],
              $.canvas.history.currentObjects()
            );
            $.canvas.history.appendAll($objects);

            log("shape changing - START");
            log($(this).data("objectID"));
          }
        );

        $(".canvas:visible,#startDrag,#centerDrag,#endDrag").on(
          "mousemove touchmove",
          function (e) {
            if (!$this.isShapeChangeDown) {
              return;
            }

            // calculate change...
            var mousePosition = $.canvas.getOffset(e);
            var changedBy = {
              x: mousePosition.x - $this.shapeStartPosition.x,
              y: mousePosition.y - $this.shapeStartPosition.y,
            };

            var $objects = $.canvas.history.currentObjects();

            // update the history array object with new coords...
            $objects[$this.shapeIndex][$this.shapePoint + "X"] += changedBy.x;
            $objects[$this.shapeIndex][$this.shapePoint + "Y"] += changedBy.y;

            $.canvas.items[$objects[$this.shapeIndex].type].drawMarkers(
              $objects[$this.shapeIndex],
              true
            );

            if (changedBy.x != 0 || changedBy.y != 0) {
              $this.shapeHasChangedPosition = true;
            }

            //$.canvas.reset();
            $this.shapeStartPosition = mousePosition;
            log("shape changing");
          }
        );
        $(".canvas:visible,#startDrag,#centerDrag,#endDrag").on(
          "mouseup touchend",
          function (e) {
            if (!$this.isShapeChangeDown) {
              return;
            }

            if ($this.shapeIndex >= 0 && !$this.shapeHasChangedPosition) {
              $.canvas.history.doUndo();
            }

            var $objects = $.canvas.history.currentObjects();

            $objects[$this.shapeIndex].cache = $.canvas.items[
              $objects[$this.shapeIndex].type
            ].setCache($objects[$this.shapeIndex]);
            $objects[$this.shapeIndex].hitarea = $.canvas.items[
              $objects[$this.shapeIndex].type
            ].drawHitArea(
              $objects[$this.shapeIndex],
              $(".canvas:visible").attr("id")
            );

            $this.isShapeChangeDown = false;
            $.canvas.reset();
            log("shape changing - END");
          }
        );
      }
    };
    $.canvas.items.movementline.onStart = function (e) {
      e.stopPropagation();
      e.preventDefault();

      $("#canvas-text").blur();

      if (this.isCollision(e, true)) {
        return;
      }

      $("#startDrag,#centerDrag,#endDrag").remove();
      var $objects = $.canvas.history.currentObjects();
      $.each($objects, function (i, item) {
        delete item.hasVisibleMarkers;
      });

      if (!$.canvas.items.current.drawCurve) {
        var mousePosition = $.canvas.getOffset(e);
        $.canvas.items.current.startX = mousePosition.x;
        $.canvas.items.current.startY = mousePosition.y;
        $.canvas.items.current.lines_color = $(".color_light_blue").css(
          "backgroundColor"
        );
        $.canvas.items.current.isDown = true;
      }
    };
    $.canvas.items.movementline.onEnd = function (e) {
      e.stopPropagation();
      e.preventDefault();

      if (!$.canvas.items.current.drawCurve) {
        $.canvas.items.current.drawCurve = true;
      } else {
        $.canvas.items.render($.canvas.items.current.type);
      }
    };
    $.canvas.items.movementline.onMove = function (e) {
      e.stopPropagation();
      e.preventDefault();

      $(".canvas:visible").removeClass("move");
      if (this.isCollision(e)) {
        return;
      }

      var is_iPad = navigator.userAgent.match(/iPad/i) != null;
      is_device = isMobile();
      if (!$.canvas.items.current.isDown && is_iPad) {
      } else if (!$.canvas.items.current.isDown) {
        return;
      }

      var mousePosition = $.canvas.getOffset(e);
      if (!$.canvas.items.current.drawCurve) {
        $.canvas.items.current.endX = $.canvas.items.current.centerX =
          mousePosition.x;
        $.canvas.items.current.endY = $.canvas.items.current.centerY =
          mousePosition.y;
      } else {
        $.canvas.items.current.centerX = mousePosition.x;
        $.canvas.items.current.centerY = mousePosition.y;
      }
      $.canvas.reset();
    };
    $.canvas.items.movementline.getCoords = function ($item) {
      var left = $item.startX,
        right = $item.endX,
        top = $item.startY,
        bottom = $item.endY;

      //flipped horz...
      if (left > right) {
        right = left;
        left = $item.endX;
      }

      //flipped vert...
      if (top > bottom) {
        bottom = top;
        top = $item.endY;
      }

      // Get furthest poinst...
      if ($item.centerX < left) {
        left = $item.centerX;
      }
      if ($item.centerX > right) {
        right = $item.centerX;
      }
      if ($item.centerY < top) {
        top = $item.centerY;
      }
      if ($item.centerY > bottom) {
        bottom = $item.centerY;
      }
      return { left: left, right: right, top: top, bottom: bottom };
    };
    $.canvas.items.movementline.drawHitArea = function ($item) {
      $shape = $.extend(true, {}, $item);

      //top left -> bottom right
      if ($item.startX <= $item.endX && $item.startY <= $item.endY) {
        log("top left -> bottom right");
        var left = $item.startX,
          right = $item.endX,
          top = $item.startY,
          bottom = $item.endY;

        var $org_width = right - left,
          $org_height = bottom - top;

        // Get furthest poinst...
        if ($item.centerX < left) {
          left = $item.centerX;
        }
        if ($item.centerX > right) {
          right = $item.centerX;
        }
        if ($item.centerY < top) {
          top = $item.centerY;
        }
        if ($item.centerY > bottom) {
          bottom = $item.centerY;
        }

        var $width = right - left,
          $height = bottom - top;

        $shape.startX = 0;
        $shape.endX = $item.endX - $item.startX;

        $shape.startY = 0;
        $shape.endY = $item.endY - $item.startY;

        $shape.centerX = $item.centerX - $item.startX;
        $shape.centerY = $item.centerY - $item.startY;

        if ($item.startX > $item.centerX) {
          $shape.startX += $width - $org_width;
          $shape.centerX += $width - $org_width;
          $shape.endX += $width - $org_width;
        }
        if ($item.startY > $item.centerY) {
          $shape.startY += $height - $org_height;
          $shape.centerY += $height - $org_height;
          $shape.endY += $height - $org_height;
        }

        //top right -> bottom left
      } else if ($item.startX >= $item.endX && $item.startY <= $item.endY) {
        log("top right -> bottom left");
        var left = $item.endX,
          right = $item.startX,
          top = $item.startY,
          bottom = $item.endY;

        var $org_width = right - left,
          $org_height = bottom - top;

        // Get furthest poinst...
        if ($item.centerX < left) {
          left = $item.centerX;
        }
        if ($item.centerX > right) {
          right = $item.centerX;
        }
        if ($item.centerY < top) {
          top = $item.centerY;
        }
        if ($item.centerY > bottom) {
          bottom = $item.centerY;
        }

        var $width = right - left,
          $height = bottom - top;

        $shape.startX = $item.startX - $item.endX;
        $shape.endX = 0;

        $shape.startY = 0;
        $shape.endY = $item.endY - $item.startY;

        $shape.centerX = $item.centerX - $item.endX;
        $shape.centerY = $item.centerY - $item.startY;

        if ($item.endX > $item.centerX) {
          $shape.startX += $width - $org_width;
          $shape.centerX += $width - $org_width;
          $shape.endX += $width - $org_width;
        }
        if ($item.endY > $item.centerY) {
          $shape.startY += $height - $org_height;
          $shape.centerY += $height - $org_height;
          $shape.endY += $height - $org_height;
        }

        //bottom left -> top right
      } else if ($item.startX <= $item.endX && $item.startY >= $item.endY) {
        log("bottom left -> top right");
        var left = $item.startX,
          right = $item.endX,
          top = $item.endY,
          bottom = $item.startY;

        var $org_width = right - left,
          $org_height = bottom - top;

        // Get furthest poinst...
        if ($item.centerX < left) {
          left = $item.centerX;
        }
        if ($item.centerX > right) {
          right = $item.centerX;
        }
        if ($item.centerY < top) {
          top = $item.centerY;
        }
        if ($item.centerY > bottom) {
          bottom = $item.centerY;
        }

        var $width = right - left,
          $height = bottom - top;

        $shape.startX = 0;
        $shape.endX = $item.endX - $item.startX;

        $shape.startY = $item.startY - $item.endY;
        $shape.endY = 0;

        $shape.centerX = $item.centerX - $item.startX;
        $shape.centerY = $item.centerY - $item.endY;

        if ($item.startX > $item.centerX) {
          $shape.startX += $width - $org_width;
          $shape.centerX += $width - $org_width;
          $shape.endX += $width - $org_width;
        }
        if ($item.endY > $item.centerY) {
          $shape.startY += $height - $org_height;
          $shape.centerY += $height - $org_height;
          $shape.endY += $height - $org_height;
        }
      } else if ($item.startX >= $item.endX && $item.startY >= $item.endY) {
        log("bottom right -> top left");
        var left = $item.endX,
          right = $item.startX,
          top = $item.endY,
          bottom = $item.startY;

        var $org_width = right - left,
          $org_height = bottom - top;

        // Get furthest poinst...
        if ($item.centerX < left) {
          left = $item.centerX;
        }
        if ($item.centerX > right) {
          right = $item.centerX;
        }
        if ($item.centerY < top) {
          top = $item.centerY;
        }
        if ($item.centerY > bottom) {
          bottom = $item.centerY;
        }

        var $width = right - left,
          $height = bottom - top;

        $shape.startX = $item.startX - $item.endX;
        $shape.endX = 0;

        $shape.startY = $item.startY - $item.endY;
        $shape.endY = 0;

        $shape.centerX = $item.centerX - $item.endX;
        $shape.centerY = $item.centerY - $item.endY;

        if ($item.endX > $item.centerX) {
          $shape.startX += $width - $org_width;
          $shape.centerX += $width - $org_width;
          $shape.endX += $width - $org_width;
        }
        if ($item.endY > $item.centerY) {
          $shape.startY += $height - $org_height;
          $shape.centerY += $height - $org_height;
          $shape.endY += $height - $org_height;
        }
      }

      $height =
        $height < this.hitAreaDefaults.lineWidth
          ? this.hitAreaDefaults.lineWidth
          : $height;
      $width =
        $width < this.hitAreaDefaults.lineWidth
          ? this.hitAreaDefaults.lineWidth
          : $width;

      var $canvas = $(
        '<canvas style="background:aqua; position:absolute; top:0; left:0;" width="' +
          $width +
          '" height="' +
          $height +
          '">Your browser does not support HTML5 Canvas.</canvas>'
      );

      $.canvas.object = $canvas[0].getContext("2d");

      this.setDefaults(true);
      this._drawshape($shape);
      console.log("9?");
      $.canvas.object = $(".canvas:visible")[0].getContext("2d");

      // for now lets append it....
      // $('#canvas-wrapper').append($canvas);

      return $canvas;
    };
    $.canvas.items.movementline._drawshape = function ($item) {
      console.log("10?");
      var endX = calculateRevX($item.x_percent) || $item.endX;
      var endY = calculateRevY($item.y_percent) || $item.endY;
      var startX = calculateRevX($item.x_start_percent) || $item.startX;
      var startY = calculateRevY($item.y_start_percent) || $item.startY;
      var centerX = calculateRevX($item.x_center_percent) || $item.centerX;
      var centerY = calculateRevY($item.y_center_percent) || $item.centerY;
      $.canvas.object.beginPath();
      $.canvas.object.moveTo(startX, startY);
      $.canvas.object.quadraticCurveTo(
        centerX,
        centerY,
        endX,
        endY
      );
      $.canvas.object.lineWidth = 2;
      $.canvas.object.setLineDash([10, 2]);

      if ($item.lines_color) {
        $.canvas.object.strokeStyle = $item.lines_color;
      }
      $.canvas.object.stroke();
      $.canvas.object.closePath();

      // Add Arrow...
      if (
        !$item.drawCurve ||
        ($item.endX === $item.centerX && $item.endY === $item.centerY)
      ) {
        $.canvas.items.applyArrow(
          startX,
          startY,
          endX,
          endY
        );
      } else {
        $.canvas.items.applyArrow(
          centerX,
          centerY,
          endX,
          endY
        );
      }
    };
  })(jQuery);

  //Demo function
  // function to draw simple solid line having arrow on head(2nd line)
  (function ($) {
    $.canvas.items.dottedstraightline = $.extend(true, {}, $.canvas.items.base);

    $.canvas.items.dottedstraightline.drawMarkers = function (
      $item,
      ignoreInteractions
    ) {
      var $this = this;

      if (!ignoreInteractions) {
        this.setDefaults();
        $item.hasVisibleMarkers = true;
        $("#startDrag,#centerDrag,#endDrag").remove();
      }

      // add padding...
      var zoomBy = 1 + $.canvas.zoomTracking / 10,
        padding = parseFloat($("body").css("font-size").replace("px", "")),
        startX = ($item.startX / $.canvas.scaledRatio) * zoomBy + padding,
        startY = ($item.startY / $.canvas.scaledRatio) * zoomBy + padding,
        centerX = ($item.centerX / $.canvas.scaledRatio) * zoomBy + padding,
        centerY = ($item.centerY / $.canvas.scaledRatio) * zoomBy + padding,
        endX = ($item.endX / $.canvas.scaledRatio) * zoomBy + padding,
        endY = ($item.endY / $.canvas.scaledRatio) * zoomBy + padding,
        $currentObjects = $.canvas.history.currentObjects(),
        $objectID = $currentObjects.indexOf($item);

      $("#startDrag")
        .data("objectID", $objectID)
        .css({ top: startY, left: startX });
      $("#centerDrag")
        .data("objectID", $objectID)
        .css({ top: centerY, left: centerX });
      $("#endDrag").data("objectID", $objectID).css({ top: endY, left: endX });

      if (!ignoreInteractions) {
        $("#startDrag,#centerDrag,#endDrag").on(
          "mousedown touchstart",
          function (e) {
            e.stopPropagation();
            e.preventDefault();
            $(".canvas:visible").addClass("move");
            $this.isShapeChangeDown = true;
            $this.shapeStartPosition = $.canvas.getOffset(e);
            $this.shapeIndex = $(this).data("objectID");
            $this.shapePoint = $(this).attr("id").split("Drag")[0];

            //duplicate current objects and push to history...
            var $objects = $.extend(
              true,
              [],
              $.canvas.history.currentObjects()
            );
            $.canvas.history.appendAll($objects);

            log("shape changing - START");
            log($(this).data("objectID"));
          }
        );

        $(".canvas:visible,#startDrag,#centerDrag,#endDrag").on(
          "mousemove touchmove",
          function (e) {
            if (!$this.isShapeChangeDown) {
              return;
            }

            // calculate change...
            var mousePosition = $.canvas.getOffset(e);
            var changedBy = {
              x: mousePosition.x - $this.shapeStartPosition.x,
              y: mousePosition.y - $this.shapeStartPosition.y,
            };

            var $objects = $.canvas.history.currentObjects();

            // update the history array object with new coords...
            $objects[$this.shapeIndex][$this.shapePoint + "X"] += changedBy.x;
            $objects[$this.shapeIndex][$this.shapePoint + "Y"] += changedBy.y;

            $.canvas.items[$objects[$this.shapeIndex].type].drawMarkers(
              $objects[$this.shapeIndex],
              true
            );

            if (changedBy.x != 0 || changedBy.y != 0) {
              $this.shapeHasChangedPosition = true;
            }

            //$.canvas.reset();
            $this.shapeStartPosition = mousePosition;
            log("shape changing");
          }
        );
        $(".canvas:visible,#startDrag,#centerDrag,#endDrag").on(
          "mouseup touchend",
          function (e) {
            if (!$this.isShapeChangeDown) {
              return;
            }

            if ($this.shapeIndex >= 0 && !$this.shapeHasChangedPosition) {
              $.canvas.history.doUndo();
            }

            var $objects = $.canvas.history.currentObjects();

            $objects[$this.shapeIndex].cache = $.canvas.items[
              $objects[$this.shapeIndex].type
            ].setCache($objects[$this.shapeIndex]);
            $objects[$this.shapeIndex].hitarea = $.canvas.items[
              $objects[$this.shapeIndex].type
            ].drawHitArea(
              $objects[$this.shapeIndex],
              $(".canvas:visible").attr("id")
            );

            $this.isShapeChangeDown = false;
            $.canvas.reset();
            log("shape changing - END");
          }
        );
      }
    };
    $.canvas.items.dottedstraightline.onStart = function (e) {
      e.stopPropagation();
      e.preventDefault();

      $("#canvas-text").blur();

      if (this.isCollision(e, true)) {
        return;
      }

      $("#startDrag,#centerDrag,#endDrag").remove();
      var $objects = $.canvas.history.currentObjects();
      $.each($objects, function (i, item) {
        delete item.hasVisibleMarkers;
      });

      if (!$.canvas.items.current.drawCurve) {
        var mousePosition = $.canvas.getOffset(e);
        $.canvas.items.current.startX = mousePosition.x;
        $.canvas.items.current.startY = mousePosition.y;
        $.canvas.items.current.lines_color = $(".color_light_blue").css(
          "backgroundColor"
        );
        $.canvas.items.current.isDown = true;
      }
    };
    $.canvas.items.dottedstraightline.onEnd = function (e) {
      e.stopPropagation();
      e.preventDefault();

      if (!$.canvas.items.current.drawCurve) {
        $.canvas.items.current.drawCurve = true;
      } else {
        $.canvas.items.render($.canvas.items.current.type);
      }
    };
    $.canvas.items.dottedstraightline.onMove = function (e) {
      e.stopPropagation();
      e.preventDefault();

      $(".canvas:visible").removeClass("move");
      if (this.isCollision(e)) {
        return;
      }

      if (!$.canvas.items.current.isDown) {
        return;
      }

      var mousePosition = $.canvas.getOffset(e);
      if (!$.canvas.items.current.drawCurve) {
        $.canvas.items.current.endX = $.canvas.items.current.centerX =
          mousePosition.x;
        $.canvas.items.current.endY = $.canvas.items.current.centerY =
          mousePosition.y;
      } else {
        $.canvas.items.current.centerX = mousePosition.x;
        $.canvas.items.current.centerY = mousePosition.y;
      }
      $.canvas.reset();
    };
    $.canvas.items.dottedstraightline.getCoords = function ($item) {
      var left = $item.startX,
        right = $item.endX,
        top = $item.startY,
        bottom = $item.endY;

      //flipped horz...
      if (left > right) {
        right = left;
        left = $item.endX;
      }

      //flipped vert...
      if (top > bottom) {
        bottom = top;
        top = $item.endY;
      }

      // Get furthest poinst...
      if ($item.centerX < left) {
        left = $item.centerX;
      }
      if ($item.centerX > right) {
        right = $item.centerX;
      }
      if ($item.centerY < top) {
        top = $item.centerY;
      }
      if ($item.centerY > bottom) {
        bottom = $item.centerY;
      }
      return { left: left, right: right, top: top, bottom: bottom };
    };
    $.canvas.items.dottedstraightline.drawHitArea = function ($item) {
      $shape = $.extend(true, {}, $item);

      //top left -> bottom right
      if ($item.startX <= $item.endX && $item.startY <= $item.endY) {
        log("top left -> bottom right");
        var left = $item.startX,
          right = $item.endX,
          top = $item.startY,
          bottom = $item.endY;

        var $org_width = right - left,
          $org_height = bottom - top;

        // Get furthest poinst...
        if ($item.centerX < left) {
          left = $item.centerX;
        }
        if ($item.centerX > right) {
          right = $item.centerX;
        }
        if ($item.centerY < top) {
          top = $item.centerY;
        }
        if ($item.centerY > bottom) {
          bottom = $item.centerY;
        }

        var $width = right - left,
          $height = bottom - top;

        $shape.startX = 0;
        $shape.endX = $item.endX - $item.startX;

        $shape.startY = 0;
        $shape.endY = $item.endY - $item.startY;

        $shape.centerX = $item.centerX - $item.startX;
        $shape.centerY = $item.centerY - $item.startY;

        if ($item.startX > $item.centerX) {
          $shape.startX += $width - $org_width;
          $shape.centerX += $width - $org_width;
          $shape.endX += $width - $org_width;
        }
        if ($item.startY > $item.centerY) {
          $shape.startY += $height - $org_height;
          $shape.centerY += $height - $org_height;
          $shape.endY += $height - $org_height;
        }

        //top right -> bottom left
      } else if ($item.startX >= $item.endX && $item.startY <= $item.endY) {
        log("top right -> bottom left");
        var left = $item.endX,
          right = $item.startX,
          top = $item.startY,
          bottom = $item.endY;

        var $org_width = right - left,
          $org_height = bottom - top;

        // Get furthest poinst...
        if ($item.centerX < left) {
          left = $item.centerX;
        }
        if ($item.centerX > right) {
          right = $item.centerX;
        }
        if ($item.centerY < top) {
          top = $item.centerY;
        }
        if ($item.centerY > bottom) {
          bottom = $item.centerY;
        }

        var $width = right - left,
          $height = bottom - top;

        $shape.startX = $item.startX - $item.endX;
        $shape.endX = 0;

        $shape.startY = 0;
        $shape.endY = $item.endY - $item.startY;

        $shape.centerX = $item.centerX - $item.endX;
        $shape.centerY = $item.centerY - $item.startY;

        if ($item.endX > $item.centerX) {
          $shape.startX += $width - $org_width;
          $shape.centerX += $width - $org_width;
          $shape.endX += $width - $org_width;
        }
        if ($item.endY > $item.centerY) {
          $shape.startY += $height - $org_height;
          $shape.centerY += $height - $org_height;
          $shape.endY += $height - $org_height;
        }

        //bottom left -> top right
      } else if ($item.startX <= $item.endX && $item.startY >= $item.endY) {
        log("bottom left -> top right");
        var left = $item.startX,
          right = $item.endX,
          top = $item.endY,
          bottom = $item.startY;

        var $org_width = right - left,
          $org_height = bottom - top;

        // Get furthest poinst...
        if ($item.centerX < left) {
          left = $item.centerX;
        }
        if ($item.centerX > right) {
          right = $item.centerX;
        }
        if ($item.centerY < top) {
          top = $item.centerY;
        }
        if ($item.centerY > bottom) {
          bottom = $item.centerY;
        }

        var $width = right - left,
          $height = bottom - top;

        $shape.startX = 0;
        $shape.endX = $item.endX - $item.startX;

        $shape.startY = $item.startY - $item.endY;
        $shape.endY = 0;

        $shape.centerX = $item.centerX - $item.startX;
        $shape.centerY = $item.centerY - $item.endY;

        if ($item.startX > $item.centerX) {
          $shape.startX += $width - $org_width;
          $shape.centerX += $width - $org_width;
          $shape.endX += $width - $org_width;
        }
        if ($item.endY > $item.centerY) {
          $shape.startY += $height - $org_height;
          $shape.centerY += $height - $org_height;
          $shape.endY += $height - $org_height;
        }
      } else if ($item.startX >= $item.endX && $item.startY >= $item.endY) {
        log("bottom right -> top left");
        var left = $item.endX,
          right = $item.startX,
          top = $item.endY,
          bottom = $item.startY;

        var $org_width = right - left,
          $org_height = bottom - top;

        // Get furthest poinst...
        if ($item.centerX < left) {
          left = $item.centerX;
        }
        if ($item.centerX > right) {
          right = $item.centerX;
        }
        if ($item.centerY < top) {
          top = $item.centerY;
        }
        if ($item.centerY > bottom) {
          bottom = $item.centerY;
        }

        var $width = right - left,
          $height = bottom - top;

        $shape.startX = $item.startX - $item.endX;
        $shape.endX = 0;

        $shape.startY = $item.startY - $item.endY;
        $shape.endY = 0;

        $shape.centerX = $item.centerX - $item.endX;
        $shape.centerY = $item.centerY - $item.endY;

        if ($item.endX > $item.centerX) {
          $shape.startX += $width - $org_width;
          $shape.centerX += $width - $org_width;
          $shape.endX += $width - $org_width;
        }
        if ($item.endY > $item.centerY) {
          $shape.startY += $height - $org_height;
          $shape.centerY += $height - $org_height;
          $shape.endY += $height - $org_height;
        }
      }

      $height =
        $height < this.hitAreaDefaults.lineWidth
          ? this.hitAreaDefaults.lineWidth
          : $height;
      $width =
        $width < this.hitAreaDefaults.lineWidth
          ? this.hitAreaDefaults.lineWidth
          : $width;

      var $canvas = $(
        '<canvas style="background:aqua; position:absolute; top:0; left:0;" width="' +
          $width +
          '" height="' +
          $height +
          '">Your browser does not support HTML5 Canvas.</canvas>'
      );

      $.canvas.object = $canvas[0].getContext("2d");

      this.setDefaults(true);
      this._drawshape($shape);
      console.log("11?");

      $.canvas.object = $(".canvas:visible")[0].getContext("2d");
      // for now lets append it....
      return $canvas;
    };
    $.canvas.items.dottedstraightline._drawshape = function ($item) {
      console.log("12?");
      var endX = calculateRevX($item.x_percent) || $item.endX;
      var endY = calculateRevY($item.y_percent) || $item.endY;
      var startX = calculateRevX($item.x_start_percent) || $item.startX;
      var startY = calculateRevY($item.y_start_percent) || $item.startY;
      var centerX = calculateRevX($item.x_center_percent) || $item.centerX;
      var centerY = calculateRevY($item.y_center_percent) || $item.centerY;
      $.canvas.object.beginPath();
      $.canvas.object.moveTo(startX, startY);
      $.canvas.object.quadraticCurveTo(
        centerX,
        centerY,
        endX,
        endY
      );
      $.canvas.object.lineWidth = 2;
      $.canvas.object.setLineDash([10, 2]);

      if ($item.lines_color) {
        $.canvas.object.strokeStyle = $item.lines_color;
      }
      $.canvas.object.stroke();
      $.canvas.object.closePath();
      $.canvas.object.setLineDash([]);
      // Add Arrow...
    };
  })(jQuery);

  //Demo function

  //function to draw dotted line but having circle on head(4th)
  (function ($) {
    $.canvas.items.movementlineheadcircle = $.extend(
      true,
      {},
      $.canvas.items.base
    );

    $.canvas.items.movementlineheadcircle.drawMarkers = function (
      $item,
      ignoreInteractions
    ) {
      var $this = this;

      if (!ignoreInteractions) {
        this.setDefaults();
        $item.hasVisibleMarkers = true;
        $("#startDrag,#centerDrag,#endDrag").remove();
      }

      // add padding...
      var zoomBy = 1 + $.canvas.zoomTracking / 10,
        padding = parseFloat($("body").css("font-size").replace("px", "")),
        startX = ($item.startX / $.canvas.scaledRatio) * zoomBy + padding,
        startY = ($item.startY / $.canvas.scaledRatio) * zoomBy + padding,
        centerX = ($item.centerX / $.canvas.scaledRatio) * zoomBy + padding,
        centerY = ($item.centerY / $.canvas.scaledRatio) * zoomBy + padding,
        endX = ($item.endX / $.canvas.scaledRatio) * zoomBy + padding,
        endY = ($item.endY / $.canvas.scaledRatio) * zoomBy + padding,
        $currentObjects = $.canvas.history.currentObjects(),
        $objectID = $currentObjects.indexOf($item);

      $("#startDrag")
        .data("objectID", $objectID)
        .css({ top: startY, left: startX });
      $("#centerDrag")
        .data("objectID", $objectID)
        .css({ top: centerY, left: centerX });
      $("#endDrag").data("objectID", $objectID).css({ top: endY, left: endX });

      if (!ignoreInteractions) {
        $("#startDrag,#centerDrag,#endDrag").on(
          "mousedown touchstart",
          function (e) {
            e.stopPropagation();
            e.preventDefault();
            $(".canvas:visible").addClass("move");
            $this.isShapeChangeDown = true;
            $this.shapeStartPosition = $.canvas.getOffset(e);
            $this.shapeIndex = $(this).data("objectID");
            $this.shapePoint = $(this).attr("id").split("Drag")[0];

            //duplicate current objects and push to history...
            var $objects = $.extend(
              true,
              [],
              $.canvas.history.currentObjects()
            );
            $.canvas.history.appendAll($objects);

            log("shape changing - START");
            log($(this).data("objectID"));
          }
        );

        $(".canvas:visible,#startDrag,#centerDrag,#endDrag").on(
          "mousemove touchmove",
          function (e) {
            if (!$this.isShapeChangeDown) {
              return;
            }

            // calculate change...
            var mousePosition = $.canvas.getOffset(e);
            var changedBy = {
              x: mousePosition.x - $this.shapeStartPosition.x,
              y: mousePosition.y - $this.shapeStartPosition.y,
            };

            var $objects = $.canvas.history.currentObjects();

            // update the history array object with new coords...
            $objects[$this.shapeIndex][$this.shapePoint + "X"] += changedBy.x;
            $objects[$this.shapeIndex][$this.shapePoint + "Y"] += changedBy.y;

            $.canvas.items[$objects[$this.shapeIndex].type].drawMarkers(
              $objects[$this.shapeIndex],
              true
            );

            if (changedBy.x != 0 || changedBy.y != 0) {
              $this.shapeHasChangedPosition = true;
            }

            //$.canvas.reset();
            $this.shapeStartPosition = mousePosition;
            log("shape changing");
          }
        );
        $(".canvas:visible,#startDrag,#centerDrag,#endDrag").on(
          "mouseup touchend",
          function (e) {
            if (!$this.isShapeChangeDown) {
              return;
            }

            if ($this.shapeIndex >= 0 && !$this.shapeHasChangedPosition) {
              $.canvas.history.doUndo();
            }

            var $objects = $.canvas.history.currentObjects();

            $objects[$this.shapeIndex].cache = $.canvas.items[
              $objects[$this.shapeIndex].type
            ].setCache($objects[$this.shapeIndex]);
            $objects[$this.shapeIndex].hitarea = $.canvas.items[
              $objects[$this.shapeIndex].type
            ].drawHitArea(
              $objects[$this.shapeIndex],
              $(".canvas:visible").attr("id")
            );

            $this.isShapeChangeDown = false;
            $.canvas.reset();
            log("shape changing - END");
          }
        );
      }
    };
    $.canvas.items.movementlineheadcircle.onStart = function (e) {
      e.stopPropagation();
      e.preventDefault();

      $("#canvas-text").blur();

      if (this.isCollision(e, true)) {
        return;
      }

      $("#startDrag,#centerDrag,#endDrag").remove();
      var $objects = $.canvas.history.currentObjects();
      $.each($objects, function (i, item) {
        delete item.hasVisibleMarkers;
      });

      if (!$.canvas.items.current.drawCurve) {
        var mousePosition = $.canvas.getOffset(e);
        $.canvas.items.current.startX = mousePosition.x;
        $.canvas.items.current.startY = mousePosition.y;
        $.canvas.items.current.lines_color = $(".color_light_blue").css(
          "backgroundColor"
        );
        $.canvas.items.current.isDown = true;
      }
    };
    $.canvas.items.movementlineheadcircle.onEnd = function (e) {
      e.stopPropagation();
      e.preventDefault();

      if (!$.canvas.items.current.drawCurve) {
        $.canvas.items.current.drawCurve = true;
      } else {
        $.canvas.items.render($.canvas.items.current.type);
      }
    };
    $.canvas.items.movementlineheadcircle.onMove = function (e) {
      e.stopPropagation();
      e.preventDefault();

      $(".canvas:visible").removeClass("move");
      if (this.isCollision(e)) {
        return;
      }

      if (!$.canvas.items.current.isDown) {
        return;
      }

      var mousePosition = $.canvas.getOffset(e);
      if (!$.canvas.items.current.drawCurve) {
        $.canvas.items.current.endX = $.canvas.items.current.centerX =
          mousePosition.x;
        $.canvas.items.current.endY = $.canvas.items.current.centerY =
          mousePosition.y;
      } else {
        $.canvas.items.current.centerX = mousePosition.x;
        $.canvas.items.current.centerY = mousePosition.y;
      }
      $.canvas.reset();
    };
    $.canvas.items.movementlineheadcircle.getCoords = function ($item) {
      var left = $item.startX,
        right = $item.endX,
        top = $item.startY,
        bottom = $item.endY;

      //flipped horz...
      if (left > right) {
        right = left;
        left = $item.endX;
      }

      //flipped vert...
      if (top > bottom) {
        bottom = top;
        top = $item.endY;
      }

      // Get furthest poinst...
      if ($item.centerX < left) {
        left = $item.centerX;
      }
      if ($item.centerX > right) {
        right = $item.centerX;
      }
      if ($item.centerY < top) {
        top = $item.centerY;
      }
      if ($item.centerY > bottom) {
        bottom = $item.centerY;
      }
      return { left: left, right: right, top: top, bottom: bottom };
    };
    $.canvas.items.movementlineheadcircle.drawHitArea = function ($item) {
      $shape = $.extend(true, {}, $item);

      //top left -> bottom right
      if ($item.startX <= $item.endX && $item.startY <= $item.endY) {
        log("top left -> bottom right");
        var left = $item.startX,
          right = $item.endX,
          top = $item.startY,
          bottom = $item.endY;

        var $org_width = right - left,
          $org_height = bottom - top;

        // Get furthest poinst...
        if ($item.centerX < left) {
          left = $item.centerX;
        }
        if ($item.centerX > right) {
          right = $item.centerX;
        }
        if ($item.centerY < top) {
          top = $item.centerY;
        }
        if ($item.centerY > bottom) {
          bottom = $item.centerY;
        }

        var $width = right - left,
          $height = bottom - top;

        $shape.startX = 0;
        $shape.endX = $item.endX - $item.startX;

        $shape.startY = 0;
        $shape.endY = $item.endY - $item.startY;

        $shape.centerX = $item.centerX - $item.startX;
        $shape.centerY = $item.centerY - $item.startY;

        if ($item.startX > $item.centerX) {
          $shape.startX += $width - $org_width;
          $shape.centerX += $width - $org_width;
          $shape.endX += $width - $org_width;
        }
        if ($item.startY > $item.centerY) {
          $shape.startY += $height - $org_height;
          $shape.centerY += $height - $org_height;
          $shape.endY += $height - $org_height;
        }

        //top right -> bottom left
      } else if ($item.startX >= $item.endX && $item.startY <= $item.endY) {
        log("top right -> bottom left");
        var left = $item.endX,
          right = $item.startX,
          top = $item.startY,
          bottom = $item.endY;

        var $org_width = right - left,
          $org_height = bottom - top;

        // Get furthest poinst...
        if ($item.centerX < left) {
          left = $item.centerX;
        }
        if ($item.centerX > right) {
          right = $item.centerX;
        }
        if ($item.centerY < top) {
          top = $item.centerY;
        }
        if ($item.centerY > bottom) {
          bottom = $item.centerY;
        }

        var $width = right - left,
          $height = bottom - top;

        $shape.startX = $item.startX - $item.endX;
        $shape.endX = 0;

        $shape.startY = 0;
        $shape.endY = $item.endY - $item.startY;

        $shape.centerX = $item.centerX - $item.endX;
        $shape.centerY = $item.centerY - $item.startY;

        if ($item.endX > $item.centerX) {
          $shape.startX += $width - $org_width;
          $shape.centerX += $width - $org_width;
          $shape.endX += $width - $org_width;
        }
        if ($item.endY > $item.centerY) {
          $shape.startY += $height - $org_height;
          $shape.centerY += $height - $org_height;
          $shape.endY += $height - $org_height;
        }

        //bottom left -> top right
      } else if ($item.startX <= $item.endX && $item.startY >= $item.endY) {
        log("bottom left -> top right");
        var left = $item.startX,
          right = $item.endX,
          top = $item.endY,
          bottom = $item.startY;

        var $org_width = right - left,
          $org_height = bottom - top;

        // Get furthest poinst...
        if ($item.centerX < left) {
          left = $item.centerX;
        }
        if ($item.centerX > right) {
          right = $item.centerX;
        }
        if ($item.centerY < top) {
          top = $item.centerY;
        }
        if ($item.centerY > bottom) {
          bottom = $item.centerY;
        }

        var $width = right - left,
          $height = bottom - top;

        $shape.startX = 0;
        $shape.endX = $item.endX - $item.startX;

        $shape.startY = $item.startY - $item.endY;
        $shape.endY = 0;

        $shape.centerX = $item.centerX - $item.startX;
        $shape.centerY = $item.centerY - $item.endY;

        if ($item.startX > $item.centerX) {
          $shape.startX += $width - $org_width;
          $shape.centerX += $width - $org_width;
          $shape.endX += $width - $org_width;
        }
        if ($item.endY > $item.centerY) {
          $shape.startY += $height - $org_height;
          $shape.centerY += $height - $org_height;
          $shape.endY += $height - $org_height;
        }
      } else if ($item.startX >= $item.endX && $item.startY >= $item.endY) {
        log("bottom right -> top left");
        var left = $item.endX,
          right = $item.startX,
          top = $item.endY,
          bottom = $item.startY;

        var $org_width = right - left,
          $org_height = bottom - top;

        // Get furthest poinst...
        if ($item.centerX < left) {
          left = $item.centerX;
        }
        if ($item.centerX > right) {
          right = $item.centerX;
        }
        if ($item.centerY < top) {
          top = $item.centerY;
        }
        if ($item.centerY > bottom) {
          bottom = $item.centerY;
        }

        var $width = right - left,
          $height = bottom - top;

        $shape.startX = $item.startX - $item.endX;
        $shape.endX = 0;

        $shape.startY = $item.startY - $item.endY;
        $shape.endY = 0;

        $shape.centerX = $item.centerX - $item.endX;
        $shape.centerY = $item.centerY - $item.endY;

        if ($item.endX > $item.centerX) {
          $shape.startX += $width - $org_width;
          $shape.centerX += $width - $org_width;
          $shape.endX += $width - $org_width;
        }
        if ($item.endY > $item.centerY) {
          $shape.startY += $height - $org_height;
          $shape.centerY += $height - $org_height;
          $shape.endY += $height - $org_height;
        }
      }

      $height =
        $height < this.hitAreaDefaults.lineWidth
          ? this.hitAreaDefaults.lineWidth
          : $height;
      $width =
        $width < this.hitAreaDefaults.lineWidth
          ? this.hitAreaDefaults.lineWidth
          : $width;

      var $canvas = $(
        '<canvas style="background:aqua; position:absolute; top:0; left:0;" width="' +
          $width +
          '" height="' +
          $height +
          '">Your browser does not support HTML5 Canvas.</canvas>'
      );

      $.canvas.object = $canvas[0].getContext("2d");

      this.setDefaults(true);
      this._drawshape($shape);
      console.log("13?");

      $.canvas.object = $(".canvas:visible")[0].getContext("2d");

      // for now lets append it....
      // $('#canvas-wrapper').append($canvas);

      return $canvas;
    };
    $.canvas.items.movementlineheadcircle._drawshape = function ($item) {
      console.log("14?");
      var endX = calculateRevX($item.x_percent) || $item.endX;
      var endY = calculateRevY($item.y_percent) || $item.endY;
      var startX = calculateRevX($item.x_start_percent) || $item.startX;
      var startY = calculateRevY($item.y_start_percent) || $item.startY;
      var centerX = calculateRevX($item.x_center_percent) || $item.centerX;
      var centerY = calculateRevY($item.y_center_percent) || $item.centerY;
      $.canvas.object.beginPath();
      $.canvas.object.moveTo(startX, startY);
      $.canvas.object.quadraticCurveTo(
        centerX,
        centerY,
        endX,
        endY
      );
      $.canvas.object.lineWidth = 2;
      $.canvas.object.setLineDash([10, 2]);
      if ($item.lines_color) {
        $.canvas.object.strokeStyle = $item.lines_color;
      }
      $.canvas.object.stroke();
      $.canvas.object.closePath();

      // Add Arrow...
      if (
        !$item.drawCurve ||
        ($item.endX === $item.centerX && $item.endY === $item.centerY)
      ) {
        $.canvas.items.applyDot(
          startX,
          startY,
          endX,
          endY,
          $item.lines_color
        );
      } else {
        $.canvas.items.applyDot(
          centerX,
          centerY,
          endX,
          endY,
          $item.lines_color
        );
      }
    };
  })(jQuery);

  //End of function

  (function ($) {
    $.canvas.items.dribble = $.extend(true, {}, $.canvas.items.basicline);
    $.canvas.items.dribble.defaults = {
      //strokeStyle : '#000'
      strokeStyle: "#ffffff",
    };
    $.canvas.items.dribble._drawshape = function ($item) {
      console.log("15?");
      // calculate how many waves to create...
      var endX = calculateRevX($item.x_percent) || $item.endX;
      var endY = calculateRevY($item.y_percent) || $item.endY;
      var startX = calculateRevX($item.x_start_percent) || $item.startX;
      var startY = calculateRevY($item.y_start_percent) || $item.startY;
      var centerX = calculateRevX($item.x_center_percent) || $item.centerX;
      var centerY = calculateRevY($item.y_center_percent) || $item.centerY;
      var wavewidth = 40,
        length = $.canvas.items.getLineLength(
          startX,
          startY,
          endX,
          endY
        ),
        maxWaves = Math.floor(length / wavewidth),
        xDiff =
          startX > endX
            ? startX - endX
            : endX - startX,
        yDiff =
          startY > endY
            ? startY - endY
            : endY - startY,
        curX = startX,
        curY = startY;

      $.canvas.object.beginPath();
      $.canvas.object.moveTo(startX, startY);

      for (var i = 1; i <= maxWaves; i++) {
        //get partial position for this wave...
        var perc = ((i * wavewidth) / length) * 100;
        var xPos =
          startX > endX
            ? startX - (xDiff / 100) * perc
            : startX + (xDiff / 100) * perc;
        var yPos =
          startY > endY
            ? startY - (yDiff / 100) * perc
            : startY + (yDiff / 100) * perc;

        $.canvas.items.dribble._wave(curX, curY, xPos, yPos);

        curX = xPos;
        curY = yPos;
      }

      $.canvas.object.lineTo(endX, endY);
      $.canvas.object.setLineDash([10, 2]);
      $.canvas.object.lineWidth = 2;
      if ($item.lines_color) {
        $.canvas.object.strokeStyle = $item.lines_color;
      }
      $.canvas.object.stroke();
      $.canvas.object.closePath();

      // Add Arrow...
      $.canvas.items.applyArrow(
        startX,
        startY,
        endX,
        endY
      );
    };
    $.canvas.items.dribble._wave = function (x1, y1, x2, y2) {
      var directionHighToLow = false;

      if (x1 > x2) {
        directionHighToLow = y1 > y2;
      } else {
        directionHighToLow = y2 > y1;
      }

      var xDiff = x1 > x2 ? x1 - x2 : x2 - x1;
      var yDiff = y1 > y2 ? y1 - y2 : y2 - y1;
      var totalDiff = xDiff + yDiff;
      var yPerc = (yDiff / totalDiff) * 100;
      var xPerc = (xDiff / totalDiff) * 100;

      var midPoint = { x: (x2 + x1) / 2, y: (y2 + y1) / 2 };
      var firstControlPoint = {
        x: (x1 + midPoint.x) / 2,
        y: (y1 + midPoint.y) / 2,
      };
      var secondControlPoint = {
        x: (x2 + midPoint.x) / 2,
        y: (y2 + midPoint.y) / 2,
      };

      // calculates the length of the line between the start position and the current
      // mouse position.
      var distanceBetweenPoints = $.canvas.items.getLineLength(x1, y1, x2, y2);
      distanceBetweenPoints /= 2;

      // calculates the amount of extra pixels that will help create the loopy effect,
      // this is a percentage of the distance between the start and current positions.
      var extraPixels = (distanceBetweenPoints / 100) * 80;

      // takes a value away for the y position of the control point to give a loopy
      // effect.
      if (directionHighToLow) {
        firstControlPoint.x += (extraPixels / 100) * yPerc;
        firstControlPoint.y -= (extraPixels / 100) * xPerc;
        secondControlPoint.x -= (extraPixels / 100) * yPerc;
        secondControlPoint.y += (extraPixels / 100) * xPerc;
      } else {
        firstControlPoint.x -= (extraPixels / 100) * yPerc;
        firstControlPoint.y -= (extraPixels / 100) * xPerc;
        secondControlPoint.x += (extraPixels / 100) * yPerc;
        secondControlPoint.y += (extraPixels / 100) * xPerc;
      }

      $.canvas.object.quadraticCurveTo(
        firstControlPoint.x,
        firstControlPoint.y,
        midPoint.x,
        midPoint.y
      );
      $.canvas.object.quadraticCurveTo(
        secondControlPoint.x,
        secondControlPoint.y,
        x2,
        y2
      );
    };
  })(jQuery);

  //function to draw dribble line having circle on head
  (function ($) {
    $.canvas.items.dribblecircle = $.extend(true, {}, $.canvas.items.basicline);

    $.canvas.items.dribblecircle.defaults = {
      strokeStyle: "#ffffff",
    };
    $.canvas.items.dribblecircle._drawshape = function ($item) {
      console.log("16?");
      var endX = calculateRevX($item.x_percent) || $item.endX;
      var endY = calculateRevY($item.y_percent) || $item.endY;
      var startX = calculateRevX($item.x_start_percent) || $item.startX;
      var startY = calculateRevY($item.y_start_percent) || $item.startY;
      var centerX = calculateRevX($item.x_center_percent) || $item.centerX;
      var centerY = calculateRevY($item.y_center_percent) || $item.centerY;
      // calculate how many waves to create...
      var wavewidth = 40,
        length = $.canvas.items.getLineLength(
          startX,
          startY,
          endX,
          endY
        ),
        maxWaves = Math.floor(length / wavewidth),
        xDiff =
          startX > endX
            ? startX - endX
            : endX - startX,
        yDiff =
          startY > endY
            ? startY - endY
            : endY - startY,
        curX = startX,
        curY = startY;

      $.canvas.object.beginPath();
      $.canvas.object.moveTo(startX, startY);

      for (var i = 1; i <= maxWaves; i++) {
        //get partial position for this wave...
        var perc = ((i * wavewidth) / length) * 100;
        var xPos =
          startX > endX
            ? startX - (xDiff / 100) * perc
            : startX + (xDiff / 100) * perc;
        var yPos =
          startY > endY
            ? startY - (yDiff / 100) * perc
            : startY + (yDiff / 100) * perc;

        $.canvas.items.dribblecircle._wave(curX, curY, xPos, yPos);

        curX = xPos;
        curY = yPos;
      }

      $.canvas.object.lineTo(endX, endY);
      $.canvas.object.setLineDash([10, 2]);
      $.canvas.object.lineWidth = 2;
      if ($item.lines_color) {
        $.canvas.object.strokeStyle = $item.lines_color;
      }
      $.canvas.object.stroke();
      $.canvas.object.closePath();

      // Add circle...
      $.canvas.items.applyDot(
        startX,
        startY,
        endX,
        endY,
        $item.lines_color
      );
    };
    $.canvas.items.dribblecircle._wave = function (x1, y1, x2, y2) {
      var directionHighToLow = false;

      if (x1 > x2) {
        directionHighToLow = y1 > y2;
      } else {
        directionHighToLow = y2 > y1;
      }

      var xDiff = x1 > x2 ? x1 - x2 : x2 - x1;
      var yDiff = y1 > y2 ? y1 - y2 : y2 - y1;
      var totalDiff = xDiff + yDiff;
      var yPerc = (yDiff / totalDiff) * 100;
      var xPerc = (xDiff / totalDiff) * 100;

      var midPoint = { x: (x2 + x1) / 2, y: (y2 + y1) / 2 };
      var firstControlPoint = {
        x: (x1 + midPoint.x) / 2,
        y: (y1 + midPoint.y) / 2,
      };
      var secondControlPoint = {
        x: (x2 + midPoint.x) / 2,
        y: (y2 + midPoint.y) / 2,
      };

      // calculates the length of the line between the start position and the current
      // mouse position.
      var distanceBetweenPoints = $.canvas.items.getLineLength(x1, y1, x2, y2);
      distanceBetweenPoints /= 2;

      // calculates the amount of extra pixels that will help create the loopy effect,
      // this is a percentage of the distance between the start and current positions.
      var extraPixels = (distanceBetweenPoints / 100) * 80;

      // takes a value away for the y position of the control point to give a loopy
      // effect.
      if (directionHighToLow) {
        firstControlPoint.x += (extraPixels / 100) * yPerc;
        firstControlPoint.y -= (extraPixels / 100) * xPerc;
        secondControlPoint.x -= (extraPixels / 100) * yPerc;
        secondControlPoint.y += (extraPixels / 100) * xPerc;
      } else {
        firstControlPoint.x -= (extraPixels / 100) * yPerc;
        firstControlPoint.y -= (extraPixels / 100) * xPerc;
        secondControlPoint.x += (extraPixels / 100) * yPerc;
        secondControlPoint.y += (extraPixels / 100) * xPerc;
      }

      $.canvas.object.quadraticCurveTo(
        firstControlPoint.x,
        firstControlPoint.y,
        midPoint.x,
        midPoint.y
      );
      $.canvas.object.quadraticCurveTo(
        secondControlPoint.x,
        secondControlPoint.y,
        x2,
        y2
      );
    };
  })(jQuery);
  //End of function

  (function ($) {
    $.canvas.items.pen = $.extend(true, {}, $.canvas.items.base);
    $.canvas.items.pen.onStart = function (e) {
      $("#canvas-text").blur();
      e.stopPropagation();
      e.preventDefault();
      if (this.isCollision(e, true)) {
        return;
      }
      var $objects = $.canvas.history.currentObjects();
      $.each($objects, function (i, item) {
        delete item.hasVisibleMarkers;
      });

      var mousePosition = $.canvas.getOffset(e);
      $.canvas.items.current.startX = mousePosition.x;
      $.canvas.items.current.startY = mousePosition.y;
      $.canvas.items.current.lines_color = $(".color_light_blue").css(
        "backgroundColor"
      );
      $.canvas.items.current.points = [];
      $.canvas.items.current.isDown = true;

      $.canvas.items.previousClass = $.canvas.items.current.type;
      $.canvas.items.previousBtn = $("#movement-navigation li.active a");
    };
    $.canvas.items.pen.onMove = function (e) {
      e.stopPropagation();
      e.preventDefault();

      $(".canvas:visible").removeClass("move");
      if (this.isCollision(e)) {
        return;
      }

      if (!$.canvas.items.current.isDown) {
        return;
      }

      var mousePosition = $.canvas.getOffset(e);
      $.canvas.items.current.points.push({
        x: mousePosition.x,
        y: mousePosition.y,
      });
      $.canvas.items.current.endX = mousePosition.x;
      $.canvas.items.current.endY = mousePosition.y;

      $.canvas.reset();
    };
    $.canvas.items.pen.updatePosition = function ($item, changedBy) {
      $item.startX += changedBy.x;
      $item.endX += changedBy.x;
      $item.startY += changedBy.y;
      $item.endY += changedBy.y;
      $.each($item.points, function (i, item) {
        $item.points[i].x += changedBy.x;
        $item.points[i].y += changedBy.y;
      });
    };
    $.canvas.items.pen.getCoords = function ($item) {
      // loop points & get min,max for left,right,top,bottom... include $item.startX, $item.endY etc as these are used too.
      var left = $item.startX,
        right = $item.endX,
        top = $item.startY,
        bottom = $item.endY;

      // Get furthest Left point...
      $.each($item.points, function (i, item) {
        if (item.x < left) {
          left = item.x;
        }
        if (item.x > right) {
          right = item.x;
        }
        if (item.y < top) {
          top = item.y;
        }
        if (item.y > bottom) {
          bottom = item.y;
        }
      });
      return { left: left, right: right, top: top, bottom: bottom };
    };
    $.canvas.items.pen.drawHitArea = function ($item) {
      $shape = $.extend(true, {}, $item);

      var left = $shape.startX,
        right = $shape.endX,
        top = $shape.startY,
        bottom = $shape.endY;

      // Get furthest Left point...
      $.each($shape.points, function (i, item) {
        if (item.x < left) {
          left = item.x;
        }
        if (item.x > right) {
          right = item.x;
        }
        if (item.y < top) {
          top = item.y;
        }
        if (item.y > bottom) {
          bottom = item.y;
        }
      });

      var $width = right - left,
        $height = bottom - top;

      // update all points...
      $.each($shape.points, function (i, item) {
        $shape.points[i].x -= left;
        $shape.points[i].y -= top;
      });

      $shape.startX -= left;
      $shape.endX -= left;
      $shape.startY -= top;
      $shape.endY -= top;

      var $tooSmall = false;
      if (
        $height < this.hitAreaDefaults.lineWidth ||
        $width < this.hitAreaDefaults.lineWidth
      ) {
        $tooSmall = true;
        $width =
          $width < this.hitAreaDefaults.lineWidth
            ? this.hitAreaDefaults.lineWidth
            : $width;
        $height =
          $height < this.hitAreaDefaults.lineWidth
            ? this.hitAreaDefaults.lineWidth
            : $height;
      }

      var $canvas = $(
        '<canvas width="' +
          $width +
          '" height="' +
          $height +
          '">Your browser does not support HTML5 Canvas.</canvas>'
      );

      $.canvas.object = $canvas[0].getContext("2d");

      if ($tooSmall) {
        // just create a rectangle of color...
        $.canvas.object.fillStyle = "#000";
        $.canvas.object.fillRect(0, 0, $width, $height);
      } else {
        this.setDefaults(true);
        this._drawshape($shape);
        console.log("17?");
      }

      $.canvas.object = $(".canvas:visible")[0].getContext("2d");

      // for now lets append it....

      return $canvas;
    };
    $.canvas.items.pen._drawshape = function ($item) {
      $.canvas.object.beginPath();
      console.log("18?");
      $.canvas.object.moveTo($item.startX, $item.startY);
      for (var i = 0; i < $item.points.length; i++) {
        $.canvas.object.lineTo($item.points[i].x, $item.points[i].y);
      }
      $.canvas.object.lineTo($item.endX, $item.endY);
      $.canvas.object.lineWidth = 2;
      if ($item.lines_color) {
        $.canvas.object.strokeStyle = $item.lines_color;
      }
      $.canvas.object.stroke();
      $.canvas.object.closePath();
      $.canvas.items.applyEnd($item.endX, $item.endY);
    };
  })(jQuery);
  (function ($) {
    $.canvas.items.arc = $.extend(true, {}, $.canvas.items.base);
    $.canvas.items.arc.defaults = {};
    $.canvas.items.arc.onMove = function (e) {
      e.stopPropagation();
      e.preventDefault();

      $(".canvas:visible").removeClass("move");
      if (this.isCollision(e)) {
        return;
      }

      if (!$.canvas.items.current.isDown) {
        return;
      }

      var mousePosition = $.canvas.getOffset(e);

      $.canvas.items.current.endX = mousePosition.x;
      $.canvas.items.current.endY = mousePosition.y;

      $.canvas.items.current.centerX = mousePosition.x;
      $.canvas.items.current.centerY = $.canvas.items.current.startY;

      $.canvas.reset();
    };
    $.canvas.items.arc.drawHitArea = function ($item) {
      $shape = $.extend(true, {}, $item);
      var $width = $shape.endX - $shape.startX,
        $height = $shape.endY - $shape.startY;

      $shape.startX = 0;
      $shape.endX = $width;
      $shape.startY = 0;
      $shape.endY = $height;

      //flipped horz...
      if ($width < 0) {
        $width = $shape.startX - $shape.endX;
        $shape.startX = $width;
        $shape.endX = 0;
      }
      //flipped vert...
      if ($height < 0) {
        $height = $shape.startY - $shape.endY;
        $shape.startY = $height;
        $shape.endY = 0;
      }

      $shape.centerX = $shape.endX;
      $shape.centerY = $shape.startY;

      var $tooSmall = false;
      if (
        $height < this.hitAreaDefaults.lineWidth ||
        $width < this.hitAreaDefaults.lineWidth
      ) {
        $tooSmall = true;
        $width =
          $width < this.hitAreaDefaults.lineWidth
            ? this.hitAreaDefaults.lineWidth
            : $width;
        $height =
          $height < this.hitAreaDefaults.lineWidth
            ? this.hitAreaDefaults.lineWidth
            : $height;
      }

      var $canvas = $(
        '<canvas width="' +
          $width +
          '" height="' +
          $height +
          '">Your browser does not support HTML5 Canvas.</canvas>'
      );

      $.canvas.object = $canvas[0].getContext("2d");

      if ($tooSmall) {
        // just create a rectangle of color...
        $.canvas.object.fillStyle = "#000";
        $.canvas.object.fillRect(0, 0, $width, $height);
      } else {
        this.setDefaults(true);
        this._drawshape($shape);
        console.log("19?");
      }

      $.canvas.object = $(".canvas:visible")[0].getContext("2d");

      // for now lets append it....
      // $('#canvas-wrapper').append($canvas);

      return $canvas;
    };
    $.canvas.items.arc._drawshape = function ($item) {
      console.log("20?");
      $.canvas.object.beginPath();
      $.canvas.object.moveTo($item.startX, $item.startY);
      $.canvas.object.quadraticCurveTo(
        $item.centerX,
        $item.centerY,
        $item.endX,
        $item.endY
      );
      $.canvas.object.lineWidth = 2;
      if ($item.lines_color) {
        $.canvas.object.strokeStyle = $item.lines_color;
      }
      $.canvas.object.stroke();
      $.canvas.object.closePath();

      // Add Arrow...
      if ($item.endX === $item.centerX && $item.endY === $item.centerY) {
        $.canvas.items.applyArrow(
          $item.startX,
          $item.startY,
          $item.endX,
          $item.endY
        );
      } else {
        $.canvas.items.applyArrow(
          $item.centerX,
          $item.centerY,
          $item.endX,
          $item.endY
        );
      }
    };
  })(jQuery);
}

shadowStyle();
function shadowStyle() {
  (function ($) {
    $.canvas.items.shadow = $.extend(true, {}, $.canvas.items.basicline);
    $.canvas.items.shadow.defaults = {
      strokeStyle: "rgba(0,0,0,0.3)",
    };
  })(jQuery);
}

drawCircle();
function drawCircle() {
  (function ($) {
    $.canvas.items.circle = $.extend(true, {}, $.canvas.items.base);
    $.canvas.items.circle.getCoords = function ($item) {
      var $width = $item.endX - $item.startX,
        $height = $item.endY - $item.startY;

      var left = $item.startX,
        right = $item.endX,
        top = $item.startY,
        bottom = $item.endY;

      //flipped horz...
      if (left > right) {
        $width = $item.startX - $item.endX;
        right = left + $width;
      }
      //flipped vert...
      if (top > bottom) {
        $height = $item.startY - $item.endY;
        bottom = top + $height;
      }

      if ($height < this.hitAreaDefaults.lineWidth) {
        top -= this.hitAreaDefaults.lineWidth / 2;
        bottom += this.hitAreaDefaults.lineWidth / 2;
      } else {
        top -= $height;
      }
      if ($width < this.hitAreaDefaults.lineWidth) {
        left -= this.hitAreaDefaults.lineWidth / 2;
        right += this.hitAreaDefaults.lineWidth / 2;
      } else {
        left -= $width;
      }

      return { left: left, right: right, top: top, bottom: bottom };
    };
    $.canvas.items.circle._drawshape = function ($item) {
      console.log("21?");
      var endX = calculateRevX($item.x_percent) || $item.endX;
      var endY = calculateRevY($item.y_percent) || $item.endY;
      var startX = calculateRevX($item.x_start_percent) || $item.startX;
      var startY = calculateRevY($item.y_start_percent) || $item.startY;
      var centerX = calculateRevX($item.x_center_percent) || $item.centerX;
      var centerY = calculateRevY($item.y_center_percent) || $item.centerY;
      // Add ellipse...
      var $width = (endX - startX) * 2,
        $height = (endY - startY) * 2;

      $.canvas.items.applyEllipse(
        startX,
        startY,
        $width,
        $height,
        "",
        $item.shapes_color,
        $item.shaded_shapes
      );
    };
    $.canvas.items.circle.drawHitArea = function ($item) {
      // Should be overridden...
      $shape = $.extend(true, {}, $item);
      var $width = ($shape.endX - $shape.startX) * 2,
        $height = ($shape.endY - $shape.startY) * 2;

      if ($width < 0) {
        $width *= -1;
      }
      if ($height < 0) {
        $height *= -1;
      }

      // alter point to fit within smaller canvas...
      $shape.startX = $width / 2;
      $shape.endX = $width;
      $shape.startY = $height / 2;
      $shape.endY = $height;

      var $tooSmall = false;
      if ($height < this.hitAreaDefaults.lineWidth) {
        $tooSmall = true;
        $shape.startY -= this.hitAreaDefaults.lineWidth / 2;
        $shape.endY += this.hitAreaDefaults.lineWidth / 2;
        $height = this.hitAreaDefaults.lineWidth;
      }
      if ($width < this.hitAreaDefaults.lineWidth) {
        $tooSmall = true;
        $shape.startX -= this.hitAreaDefaults.lineWidth / 2;
        $shape.endX += this.hitAreaDefaults.lineWidth / 2;
        $width = this.hitAreaDefaults.lineWidth;
      }

      var $canvas = $(
        '<canvas style="background:aqua" width="' +
          $width +
          '" height="' +
          $height +
          '">Your browser does not support HTML5 Canvas.</canvas>'
      );
      $.canvas.object = $canvas[0].getContext("2d");

      if ($tooSmall) {
        // just create a rectangle of color...
        $.canvas.object.fillStyle = "#000";
        $.canvas.object.fillRect(0, 0, $width, $height);
      } else {
        this.setDefaults(true);
        this._drawshape($shape);
        console.log("22?");
      }

      $.canvas.object = $(".canvas:visible")[0].getContext("2d");

      // for now lets append it....

      return $canvas;
    };
  })(jQuery);
}

circle_highlight();
function circle_highlight() {
  (function ($) {
    $.canvas.items.circle_highlight = $.extend(true, {}, $.canvas.items.circle);
    $.canvas.items.circle_highlight.defaults = {
      strokeStyle: "#ffffff",
      fillStyle: "rgba(0,0,0,0.3)",
    };
    $.canvas.items.circle_highlight.hitAreaDefaults = {
      fillStyle: "#000",
    };
  })(jQuery);
}

textarea_opposition();

function textarea_opposition() {
  (function ($) {
    $.canvas.items.textarea_opposition = $.extend(
      true,
      {},
      $.canvas.items.base
    );
    $.canvas.items.textarea_opposition.fontSize = 22;
    $.canvas.items.textarea_opposition.defaults = {
      strokeStyle: "#ffffff",
      lineWidth: 6,
      lineJoin: "round",
      font: 'bold 22px "Helvetica Neue", Helvetica, Arial',
      fillStyle: "#E70E0E",
      textAlign: "center",
      textBaseline: "top",
    };
    ($.canvas.items.textarea_opposition.onEnd = function (e) {
      e.stopPropagation();
      e.preventDefault();
    }),
      ($.canvas.items.textarea_opposition.onStart = function (e) {
        e.stopPropagation();
        e.preventDefault();

        // check to see if there are any other textareas.. if they have content render them - if® not remove them...
        $("#canvas-text").blur();

        if (this.isCollision(e, true)) {
          return;
        }

        var canvasOffset = $(".canvas:visible").offset(),
          mousePosition = $.canvas.getOffset(e);

        $.canvas.items.current.startX = $.canvas.items.current.endX =
          mousePosition.x;
        $.canvas.items.current.startY = $.canvas.items.current.endY =
          mousePosition.y;

        $(".canvas_content:visible").append(
          '<textarea style="box-shadow: none; color: red" id="canvas-text" cols="12" rows="2" placeholder="Enter Text"></textarea>'
        );

        $editableTextShape = $("#canvas-text");
        $editableTextShape.focus();

        $editableTextShape.on("keyup", function (e) {
          $.canvas.items.current.text = $editableTextShape.val().trim();
          $.canvas.items.textarea_opposition.setTextWidth(
            $.canvas.items.current
          );
        });
        $editableTextShape.on("blur", function (e) {
          $.canvas.items.textarea_opposition.removeExisting();
        });
        this.setTextPosition($.canvas.items.current);
      });
    $.canvas.items.textarea_opposition.editText = function ($ID, $obj) {
      $("#canvas-text").blur();

      // Track text changes
      var originalText = $obj.text;

      // remove text from canvas, and add to input element
      var $objects = $.canvas.history.currentObjects();
      $objects[$ID].originalText = $obj.text;
      $objects[$ID].text = "";
      $.canvas.reset();

      $(".canvas_content:visible").append(
        '<textarea style="box-shadow: none; color: red" id="canvas-text" data-object="' +
          $ID +
          '" data-original="' +
          originalText +
          '" cols="12" rows="2" placeholder="Enter Text">' +
          originalText +
          "</textarea>"
      );

      $("#canvas-text")
        .on("keyup", function (e) {
          var $objects = $.canvas.history.currentObjects();
          $objects[$ID].text = $(this).val().trim();
          $objects[$ID].text_color = $(".text-tools-colors").css(
            "background-color"
          );
          $.canvas.items.textarea_opposition.setTextWidth($objects[$ID]);
        })
        .on("blur", function (e) {
          var $objects = $.canvas.history.currentObjects();
          $objects[$(this).data("object")].text = $(this).data("original");

          if ($(this).val() !== $(this).data("original")) {
            var $objects = $.extend(
              true,
              [],
              $.canvas.history.currentObjects()
            );
            $.canvas.history.appendAll($objects);

            $objects = $.canvas.history.currentObjects();
            $objects[$(this).data("object")].text = $(this).val();
          }

          delete $objects[$(this).data("object")].originalText;
          $objects[
            $(this).data("object")
          ].hitarea = $.canvas.items.textarea_opposition.drawHitArea(
            $objects[$(this).data("object")],
            $(".canvas:visible").attr("id")
          );

          $(this).remove();
          $.canvas.reset();
        })
        .on("focus", function () {
          var $this = $(this);
          $this.select();
          // Work around Chrome's little problem
          $this.mouseup(function () {
            // Prevent further mouseup intervention
            $this.unbind("mouseup touchend");
            return false;
          });
        })
        .focus();

      this.setTextPositionFromObject($("#canvas-text"));
    };
    $.canvas.items.textarea_opposition.setTextPositionFromObject = function (
      $obj
    ) {
      var $objects = $.canvas.history.currentObjects();
      this.setTextWidth($objects[$obj.data("object")]);
    };
    $.canvas.items.textarea_opposition.removeExisting = function () {
      $("#canvas-text").each(function () {
        $editableTextShape = $(this);
        if ($editableTextShape.val().trim() !== "") {
          $.canvas.items.render($.canvas.items.current.type);
          $.canvas.reset();
        }
        $(this).remove();
      });
    };
    $.canvas.items.textarea_opposition.setTextPosition = function ($item) {
      var $editableTextShape = $("#canvas-text"),
        zoomBy = 1 + $.canvas.zoomTracking / 10,
        offset = 10,
        padding = parseFloat($("body").css("font-size").replace("px", ""));

      $editableTextShape.css({
        "font-size":
          ($.canvas.items.textarea_opposition.fontSize / $.canvas.scaledRatio) *
            zoomBy +
          "px",
      });

      var x =
          ($item.endX / $.canvas.scaledRatio) * zoomBy +
          padding -
          $("#canvas-text").width() / 2 +
          $.canvas.panX,
        y =
          ($item.endY / $.canvas.scaledRatio) * zoomBy +
          padding -
          offset +
          $.canvas.panY;

      $editableTextShape.css({ left: x + "px", top: y + "px" });
    };
    $.canvas.items.textarea_opposition.setTextWidth = function ($item) {
      var $editableTextShape = $("#canvas-text"),
        lines = $editableTextShape.val().split("\n"),
        longest = lines.reduce(function (a, b) {
          return a.length > b.length ? a : b;
        }),
        length = longest.length > 10 ? longest.length + 2 : 12;
      $editableTextShape.attr("cols", length).attr("rows", lines.length + 1);
      $.canvas.items.textarea_opposition.setTextPosition($item);
    };
    $.canvas.items.textarea_opposition.getCoords = function ($item) {
      if (!$item.text) {
        return {};
      }
      $("body").append(
        '<div id="canvas-textcaluator">' +
          $item.text.replace(/(?:\r\n|\r|\n)/g, "<br />") +
          "</div>"
      );
      var lines = $item.text.split("\n"),
        height = $("#canvas-textcaluator").height(),
        width = $("#canvas-textcaluator").width();
      $("#canvas-textcaluator").remove();

      return {
        left: $item.startX - width / 2,
        right: $item.startX + width / 2,
        top: $item.startY,
        bottom: $item.startY + height,
      };
    };
    $.canvas.items.textarea_opposition._drawshape = function ($item) {
      console.log("23?");
      if (!$item.text) {
        return;
      }
      var lines = $item.text.split("\n");
      $.each(lines, function (i, line) {
        var lineheight =
            i * ($.canvas.items.textarea_opposition.fontSize * 1.2),
          offset = -22;
        if ($item.text_color) {
          $.canvas.object.fillStyle = $item.text_color;
        }
        $.canvas.object.fillText(
          line,
          $item.endX,
          $item.endY + lineheight + offset
        );
      });
    };
    $.canvas.items.textarea_opposition.drawHitArea = function ($item) {
      if (!$item.text) {
        return;
      }

      $("body").append(
        '<div id="canvas-textcaluator">' +
          $item.text.replace(/(?:\r\n|\r|\n)/g, "<br />") +
          "</div>"
      );

      var lines = $item.text.split("\n"),
        height = $("#canvas-textcaluator").height(),
        width = $("#canvas-textcaluator").width();

      $("#canvas-textcaluator").remove();

      var $canvas = $(
        '<canvas width="' +
          width +
          '" height="' +
          height +
          '">Your browser does not support HTML5 Canvas.</canvas> '
      );

      $.canvas.object = $canvas[0].getContext("2d");

      this.setDefaults(true);
      $.canvas.object.fillStyle = "#000";

      $.each(lines, function (i, line) {
        $("body").append('<div id="canvas-textcaluator">' + line + "</div>");

        var line_height = $("#canvas-textcaluator").height(),
          line_width = $("#canvas-textcaluator").width(),
          y = i * line_height,
          x = (width - line_width) / 2;

        $("#canvas-textcaluator").remove();

        $.canvas.object.fillRect(x, y, line_width, line_height);
      });

      $.canvas.object = $(".canvas:visible")[0].getContext("2d");

      // for now lets append it....
      return $canvas;
    };

    $(function () {
      $(window).on("resize resizeend", function () {
        $("#canvas-text").blur();
      });
    });
  })(jQuery);
}

canvasText();
function canvasText() {
  (function ($) {
    $.canvas.items.textarea = $.extend(true, {}, $.canvas.items.base);
    $.canvas.items.textarea.fontSize = 19;
    $.canvas.items.textarea.defaults = {
      strokeStyle: $(".text-tools-colors").css("background-color"),
      lineWidth: 6,
      lineJoin: "round",
      font: 'bold 19px "Helvetica Neue", Helvetica, Arial',
      fillStyle: $(".text-tools-colors").css("background-color"),
      textAlign: "center",
      textBaseline: "top",
    };
    ($.canvas.items.textarea.onEnd = function (e) {
      e.stopPropagation();
      e.preventDefault();
    }),
      ($.canvas.items.textarea.onStart = function (e) {
        e.stopPropagation();
        e.preventDefault();

        // check to see if there are any other textareas.. if they have content render them - if® not remove them...
        $("#canvas-text").blur();

        if (this.isCollision(e, true)) {
          return;
        }

        var canvasOffset = $(".canvas:visible").offset(),
          mousePosition = $.canvas.getOffset(e);

        $.canvas.items.current.startX = $.canvas.items.current.endX =
          mousePosition.x;
        $.canvas.items.current.startY = $.canvas.items.current.endY =
          mousePosition.y;
        if (is_current_movement_tool == "") {
          return;
        }
        $(".canvas_content:visible").append(
          '<textarea style="box-shadow: none;" id="canvas-text" cols="12" rows="2" placeholder="Enter Text"></textarea>'
        );

        $editableTextShape = $("#canvas-text");
        $editableTextShape.focus();
        $("#canvas-text").css(
          "color",
          $(".text-tools-colors").css("background-color")
        );
        $editableTextShape.on("keyup", function (e) {
          is_current_movement_tool = "";
          $.canvas.items.current.text = $editableTextShape.val().trim();
          $.canvas.items.current.text_color = $(".text-tools-colors").css(
            "background-color"
          );
          $.canvas.items.current.font_size = $(
            "input:radio[name=size]:checked"
          ).val();
          $.canvas.items.textarea.setTextWidth($.canvas.items.current);
        });
        $editableTextShape.on("blur", function (e) {
          $.canvas.items.textarea.removeExisting();
        });
        this.setTextPosition($.canvas.items.current);
      });
    $.canvas.items.textarea.editText = function ($ID, $obj) {
      $("#canvas-text").blur();

      // Track text changes
      var originalText = $obj.text;
      var originalTextColor = $obj.text_color;

      // remove text from canvas, and add to input element
      var $objects = $.canvas.history.currentObjects();
      $objects[$ID].originalText = $obj.text;
      $objects[$ID].originalTextColor = $obj.text_color;
      $objects[$ID].text = "";
      $.canvas.reset();

      $(".canvas_content:visible").append(
        '<textarea style="box-shadow: none;" id="canvas-text" data-object="' +
          $ID +
          '" data-originalcolor="' +
          originalTextColor +
          '" data-original="' +
          originalText +
          '" cols="12" rows="2" placeholder="Enter Text">' +
          originalText +
          "</textarea>"
      );

      $("#canvas-text")
        .on("keyup", function (e) {
          var $objects = $.canvas.history.currentObjects();
          $objects[$ID].text = $(this).val().trim();
          if ($obj.text_color) {
            $objects[$ID].text_color = $obj.text_color;
          }
          $.canvas.items.textarea.setTextWidth($objects[$ID]);
        })
        .on("blur", function (e) {
          var $objects = $.canvas.history.currentObjects();
          $objects[$(this).data("object")].text = $(this).data("original");
          $objects[$(this).data("object")].text_color = $(this).data(
            "originalcolor"
          );
          if ($(this).val() !== $(this).data("original")) {
            var $objects = $.extend(
              true,
              [],
              $.canvas.history.currentObjects()
            );
            $.canvas.history.appendAll($objects);
            $objects = $.canvas.history.currentObjects();
            $objects[$(this).data("object")].text = $(this).val();
            $objects[$(this).data("object")].text_color = $obj.text_color;
          }

          delete $objects[$(this).data("object")].originalText;
          delete $objects[$(this).data("object")].originalTextColor;
          $objects[
            $(this).data("object")
          ].hitarea = $.canvas.items.textarea.drawHitArea(
            $objects[$(this).data("object")],
            $(".canvas:visible").attr("id")
          );

          $(this).remove();
          $.canvas.reset();
        })
        .on("focus", function () {
          var $this = $(this);
          $this.select();
          // Work around Chrome's little problem
          $this.mouseup(function () {
            // Prevent further mouseup intervention
            $this.unbind("mouseup touchend");
            return false;
          });
        })
        .focus();

      this.setTextPositionFromObject($("#canvas-text"));
    };
    $.canvas.items.textarea.setTextPositionFromObject = function ($obj) {
      var $objects = $.canvas.history.currentObjects();
      this.setTextWidth($objects[$obj.data("object")]);
    };
    $.canvas.items.textarea.removeExisting = function () {
      $("#canvas-text").each(function () {
        $editableTextShape = $(this);
        if ($editableTextShape.val().trim() !== "") {
          $.canvas.items.render($.canvas.items.current.type);
          $.canvas.reset();
        }
        $(this).remove();
      });
    };
    $.canvas.items.textarea.setTextPosition = function ($item) {
      var $editableTextShape = $("#canvas-text"),
        zoomBy = 1 + $.canvas.zoomTracking / 10,
        offset = 10,
        padding = parseFloat($("body").css("font-size").replace("px", ""));
      $.canvas.items.textarea.fontSize = $(
        "input:radio[name=size]:checked"
      ).attr("size");

      $editableTextShape.css({
        "font-size":
          ($.canvas.items.textarea.fontSize / $.canvas.scaledRatio) * zoomBy +
          "px",
      });

      var x =
          ($item.endX / $.canvas.scaledRatio) * zoomBy +
          padding -
          $("#canvas-text").width() / 2 +
          $.canvas.panX,
        y =
          ($item.endY / $.canvas.scaledRatio) * zoomBy +
          padding -
          offset +
          $.canvas.panY;

      $editableTextShape.css({ left: x + "px", top: y + "px" });
    };
    $.canvas.items.textarea.setTextWidth = function ($item) {
      var $editableTextShape = $("#canvas-text"),
        lines = $editableTextShape.val().split("\n"),
        longest = lines.reduce(function (a, b) {
          return a.length > b.length ? a : b;
        }),
        length = longest.length > 10 ? longest.length + 2 : 12;
      $editableTextShape.attr("cols", length).attr("rows", lines.length + 1);
      $.canvas.items.textarea.setTextPosition($item);
    };
    $.canvas.items.textarea.getCoords = function ($item) {
      if (!$item.text) {
        return {};
      }
      $("body").append(
        '<div id="canvas-textcaluator">' +
          $item.text.replace(/(?:\r\n|\r|\n)/g, "<br />") +
          "</div>"
      );
      var lines = $item.text.split("\n"),
        height = $("#canvas-textcaluator").height(),
        width = $("#canvas-textcaluator").width();
      $("#canvas-textcaluator").remove();
      var starty = $item.startY;
      if ($item.font_size.indexOf("42") >= 0) {
        var newhight = height;
      } else {
        var newhight = parseInt(height) / 2;
      }
      return {
        left: $item.startX - width / 2,
        right: $item.startX + width / 2,
        top: $item.startY,
        bottom: $item.startY + newhight,
      };
    };
    $.canvas.items.textarea._drawshape = function ($item) {
      console.log("24?");
      if (!$item.text) {
        return;
      }
      var lines = $item.text.split("\n");
      $.each(lines, function (i, line) {
        var lineheight = i * ($.canvas.items.textarea.fontSize * 1.2),
          offset = 0;
        if ($item.text_color) {
          $.canvas.object.fillStyle = $item.text_color;
        }
        if ($item.font_size) {
          $.canvas.object.font = $item.font_size;
        }
        $.canvas.object.fillText(
          line,
          $item.endX,
          $item.endY + lineheight + offset
        );
      });
    };
    $.canvas.items.textarea.drawHitArea = function ($item) {
      if (!$item.text) {
        return;
      }

      $("body").append(
        '<div id="canvas-textcaluator">' +
          $item.text.replace(/(?:\r\n|\r|\n)/g, "<br />") +
          "</div>"
      );

      var lines = $item.text.split("\n"),
        height = $("#canvas-textcaluator").height(),
        width = $("#canvas-textcaluator").width();

      $("#canvas-textcaluator").remove();

      var $canvas = $(
        '<canvas width="' +
          width +
          '" height="' +
          height +
          '">Your browser does not support HTML5 Canvas.</canvas> '
      );

      $.canvas.object = $canvas[0].getContext("2d");

      this.setDefaults(true);
      $.canvas.object.fillStyle = "#000";

      $.each(lines, function (i, line) {
        $("body").append('<div id="canvas-textcaluator">' + line + "</div>");

        var line_height = $("#canvas-textcaluator").height(),
          line_width = $("#canvas-textcaluator").width(),
          y = i * line_height,
          x = (width - line_width) / 2;

        $("#canvas-textcaluator").remove();

        $.canvas.object.fillRect(x, y, line_width, line_height);
      });

      $.canvas.object = $(".canvas:visible")[0].getContext("2d");

      // for now lets append it....
      // $('#canvas-wrapper').append($canvas);

      return $canvas;
    };

    $(function () {
      $(window).on("resize resizeend", function () {
        $("#canvas-text").blur();
      });
    });
  })(jQuery);
}

//var isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
//var mac = /Apple Computer, Inc/.test(navigator.vendor);

if (
  navigator.userAgent.indexOf("Firefox") > 0 ||
  navigator.appName == "Microsoft Internet Explorer" ||
  !!(
    navigator.userAgent.match(/Trident/) || navigator.userAgent.match(/rv:11/)
  ) ||
  (typeof $.browser !== "undefined" && $.browser.msie == 1)
) {
  draggable_sizes();
} else {
  draggable_sizes_chrome();
}
function draggable_sizes_chrome() {
  (function ($) {
    draggable_object = $.draggable_sizes = {
      ladder: [48, 116],
      ladder_horizontal: [116, 48],
      ladder_2d: [48, 116],
      ball: [50, 50],
      blue_round: [40, 30],
      flag_large: [56, 140],
      flag_small: [80, 100],
      flag: [54, 44],
      flag_3d: [24, 80],
      flag_right: [54, 44],
      yellow_flag_left: [54, 44],
      yellow_flag_right: [54, 44],
      vlctrafic: [29, 15],
      vlctrafic_yellow: [29, 15],
      red_circle_3d: [30, 30],
      blue_circle_3d: [30, 30],
      vlctrafic_2d: [29, 29],
      vlctrafic_2d_blue: [29, 29],
      red_circle: [30, 30],
      blue_circle: [30, 30],
      cone: [27, 27],
      cone_2d: [27, 27],
      pipeline: [10, 150],
      black_pole: [35, 70],
      black_pole_2d: [10, 40],
      yellow_pole: [15, 75],
      yellow_pole_2d: [35, 70],
      green_pole: [35, 70],
      red_pole: [35, 70],
      model: [35, 80],
      model_2: [60, 85],
      modelD1: [35, 80],
      modelD2: [35, 80],
      modelD3: [35, 80],
      overhead_mannequin_2d: [35, 21],

      stand1: [43, 30],
      stand2: [44, 30],
      stand3: [43, 30],
      stand4: [35, 20],
      stand5: [54, 30],
      stand6: [54, 30],
      laddar: [48, 65],
      cicle6: [90, 100],
      cicle2: [27, 21],
      cicle3: [27, 21],
      cicle4: [27, 21],
      cicle5: [27, 21],
      BL1: [40, 25],
      BL2: [80, 50],
      BL3: [40, 25],
      boxD1: [53, 43],
      boxD2: [60, 24],
      boxD3: [60, 24],
      yellowB1: [90, 30],
      yellowB2: [90, 30],
      yellowB3: [90, 30],
      stand_a: [110, 110],
      stand_b: [110, 110],
      stand_c: [120, 120],
      stand_d: [120, 120],
      stand_e: [80, 40],
      stand_f: [70, 40],
      stand_g: [110, 110],
      stand_g_right: [110, 110],
      stand_h: [110, 110],
      stand_h_right: [110, 110],
      stand_i: [90, 90],
      stand_j: [50, 100],
      stand_k: [50, 100],
      stand_l: [50, 100],
      stand_m: [50, 100],
      stand_n: [90, 90],
      stand_p: [90, 48],
      stand_o: [90, 50],
      stand_q: [50, 30],
      standq_3d_1: [48, 62],
      standq_3d_2: [90, 53],
      standq_3d_3: [90, 38],
      standq_3d_4: [65, 55],
      standq_3d_5: [48, 62],
      standq_3d_6: [100, 52],
      standq_3d_7: [66, 75],
      standq_3d_8: [66, 66],
      standq_3d_9: [66, 75],
      standq_3d_10: [53, 62],
      standq_3d_11: [53, 62],
      standq_3d_1_grey: [48, 62],
      standq_3d_2_grey: [90, 53],
      standq_3d_3_grey: [90, 38],
      standq_3d_4_grey: [65, 55],
      standq_3d_5_grey: [48, 62],
      standq_3d_6_grey: [100, 52],
      standq_3d_7_grey: [66, 75],
      standq_3d_8_grey: [66, 66],
      standq_3d_9_grey: [66, 75],
      standq_3d_10_grey: [53, 62],
      standq_3d_11_grey: [53, 62],
      tabIMG2: [130, 90],
      tabIMG1: [130, 90],
      tyre: [40, 37],
      tyre_3d: [40, 37],
      pole_yellow: [24, 152],
      pole_red: [24, 152],
      cone_yellow: [57, 36],
      cone_red: [65, 40],
      cone_orange: [57, 36],
      cone_blue: [57, 36],
      trianglecone_red: [45, 68],
      trianglecone_yellow: [45, 68],
      person_left: [68, 142],
      person: [70, 136],
      person_right: [59, 142],
      barrier_front: [160, 47],
      barrier_back: [160, 55],
      barrier_left: [65, 106],
      barrier_right: [65, 106],
      hurdle: [151, 37],
      hurdle_left: [53, 80],
      hurdle_right: [56, 82],
      goalpost_left: [90, 176],
      goalpost_right: [90, 176],
      goalpost_up: [176, 90],
      goalpost_down: [176, 90],
      goalpost_large_left: [162, 322],
      goalpost_large_right: [162, 322],
      goalpost_indoor_left: [80, 120],
      goalpost_indoor_right: [80, 120],
      goalpost_indoor_up: [130, 80],
      goalpost_indoor_down: [140, 80],
      goalpost_huge_left: [180, 200],
      goalpost_huge_left_white: [200, 240],
      goalpost_huge_right: [180, 200],
      goalpost_huge_up: [275, 125],
      goalpost_huge_down: [260, 160],
      goal_post_hgt_right: [100, 225],
      goal_post_hgt_left: [100, 225],

      net_front: [185, 90],
      net_top_1: [135, 40],
      net_top_2: [90, 140],
      net_top_3: [40, 135],
      net_top_4: [135, 40],
      net_top_5: [40, 135],
      net_top_6: [90, 140],
      net_top_1_grey: [135, 40],
      net_top_2_grey: [90, 140],
      net_top_3_grey: [40, 135],
      net_top_4_grey: [135, 40],
      net_top_5_grey: [40, 135],
      net_top_6_grey: [90, 140],
      standq_2d_1: [82, 36],
      standq_2d_2: [59, 75],
      standq_2d_3: [36, 82],
      standq_2d_4: [82, 36],
      standq_2d_5: [36, 82],
      standq_2d_6: [59, 75],
      standq_2d_1_grey: [82, 36],
      standq_2d_2_grey: [59, 75],
      standq_2d_3_grey: [36, 82],
      standq_2d_4_grey: [82, 36],
      standq_2d_5_grey: [36, 82],
      standq_2d_6_grey: [59, 75],
      net_back: [120, 90],
      net_left: [70, 95],
      net_right: [70, 95],

      net_front_white: [120, 70],
      net_left_white: [70, 95],
      net_back_white: [120, 90],
      net_right_white: [70, 95],
      goal_rotation_1: [84, 165],
      goal_rotation_2: [185, 90],
      goal_rotation_3: [185, 90],
      goal_rotation_4: [185, 120],
      goal_rotation_5: [84, 165],
      goal_rotation_6: [185, 70],
      goal_rotation_7: [170, 185],
      goal_rotation_8: [91, 150],
      goal_rotation_9: [91, 150],
      goal_rotation_10: [102, 165],
      goal_rotation_11: [97, 165],
      goal_rotation_1_grey: [80, 180],
      goal_rotation_2_grey: [185, 90],
      goal_rotation_3_grey: [185, 90],
      goal_rotation_4_grey: [185, 120],
      goal_rotation_5_grey: [80, 180],
      goal_rotation_6_grey: [185, 70],
      goal_rotation_7_grey: [170, 185],
      goal_rotation_8_grey: [91, 150],
      goal_rotation_9_grey: [91, 150],
      goal_rotation_10_grey: [102, 165],
      goal_rotation_11_grey: [97, 165],
      football: [30, 30],
      sky_blue_disc: [24, 26],
      player_circle_1: [40, 40],
      player_circle_2: [40, 40],
      player_circle_3: [40, 40],
      player_circle_4: [50, 40],
      player_circle_5: [50, 40],
      player_circle_6: [50, 40],
      player_circle_7: [50, 40],
      player_circle_8: [40, 40],
      player_circle_81: [40, 40],
      player_circle_9: [60, 40],
      player_circle_10: [60, 40],
      green_disc: [24, 26],
      yellow_disc: [24, 26],
      blue_disc: [24, 26],
      orange_disc: [24, 26],
      red_disc: [24, 26],
      majanta_disc: [24, 26],
      stopwatch: [172, 223],
      player_circle: [84, 96],
      player_circle_yellow: [34, 34],
      player_circle_green: [84, 84],
      player_triangle: [84, 96],
    };

    var alphabet = "abcdefghijklmnopqrstuvwxyz".split("");
    $.each(alphabet, function (i, $i) {
      $.draggable_sizes["letter_" + $i] = [30, 30];
    });

    for (var i = 0; i <= 9; i++) {
      $.draggable_sizes["number_" + i] = [30, 30];
    }
    if(window.innerWidth < 1024){
      $.draggable_sizes.blue_circle= [15, 15]
      $.draggable_sizes.vlctrafic_2d_blue= [15, 15]
      $.draggable_sizes.black_pole_2d= [7, 30]
      $.draggable_sizes.overhead_mannequin_2d= [26, 16]
      $.draggable_sizes.ladder_2d= [35, 87]
      $.draggable_sizes.stand4= [26, 15]
      $.draggable_sizes.boxD2= [45, 19]
      $.draggable_sizes.tyre= [30, 28]
      $.draggable_sizes.standq_2d_1_grey= [61, 26]
      $.draggable_sizes.net_top_1= [101, 30]
      $.draggable_sizes.football =  [20, 20]
      $.draggable_sizes.cone_2d = [20, 20]
      $.draggable_sizes.player_circle_1 = [30, 30]
      $.draggable_sizes.player_circle_2 = [30, 30]
      $.draggable_sizes.player_circle_3 = [30, 30]
      $.draggable_sizes.player_circle_4 = [40, 30]
      $.draggable_sizes.player_circle_5 = [40, 30]
      $.draggable_sizes.player_circle_6 = [40, 30]
      $.each(alphabet, function (i, $i) {
        $.draggable_sizes["letter_" + $i] = [15, 15];
      });
      for (var i = 0; i <= 9; i++) {
        $.draggable_sizes["number_" + i] = [15, 15];
      }
    }else if(window.innerWidth > 1920 & window.innerWidth <= 2560){
      $.draggable_sizes.blue_circle= [67, 67]
      $.draggable_sizes.vlctrafic_2d_blue= [67, 67]
      $.draggable_sizes.black_pole_2d= [22, 90]
      $.draggable_sizes.overhead_mannequin_2d= [79, 47]
      $.draggable_sizes.ladder_2d= [112, 261]
      $.draggable_sizes.stand4= [79, 45]
      $.draggable_sizes.boxD2= [135, 56]
      $.draggable_sizes.tyre= [90, 83]
      $.draggable_sizes.standq_2d_1_grey= [184, 79]
      $.draggable_sizes.net_top_1= [304, 90]
      $.draggable_sizes.football =  [60, 60]
      $.draggable_sizes.cone_2d = [60, 60]
      $.draggable_sizes.player_circle_1 = [100, 100]
      $.draggable_sizes.player_circle_2 = [100, 100]
      $.draggable_sizes.player_circle_3 = [100, 100]
      $.draggable_sizes.player_circle_4 = [120, 100]
      $.draggable_sizes.player_circle_5 = [120, 100]
      $.draggable_sizes.player_circle_6 = [120, 100]
      $.each(alphabet, function (i, $i) {
        $.draggable_sizes["letter_" + $i] = [60, 60];
      });
      for (var i = 0; i <= 9; i++) {
        $.draggable_sizes["number_" + i] = [60, 60];
      }
    }else if(window.innerWidth > 2560){ 
      $.draggable_sizes.blue_circle= [90, 90]
      $.draggable_sizes.vlctrafic_2d_blue= [90, 90]
      $.draggable_sizes.black_pole_2d= [30, 120]
      $.draggable_sizes.overhead_mannequin_2d= [105, 63]
      $.draggable_sizes.ladder_2d= [150, 348]
      $.draggable_sizes.stand4= [105, 60]
      $.draggable_sizes.boxD2= [180, 75]
      $.draggable_sizes.tyre= [120, 111]
      $.draggable_sizes.standq_2d_1_grey= [246, 105]
      $.draggable_sizes.net_top_1= [405, 120]
      $.draggable_sizes.football =  [80, 80]
      $.draggable_sizes.cone_2d = [80, 80]
      $.draggable_sizes.player_circle_1 = [100, 100]
      $.draggable_sizes.player_circle_2 = [100, 100]
      $.draggable_sizes.player_circle_3 = [100, 100]
      $.draggable_sizes.player_circle_4 = [120, 100]
      $.draggable_sizes.player_circle_5 = [120, 100]
      $.draggable_sizes.player_circle_6 = [120, 100]
      $.each(alphabet, function (i, $i) {
        $.draggable_sizes["letter_" + $i] = [90, 90];
      });
      for (var i = 0; i <= 9; i++) {
        $.draggable_sizes["number_" + i] = [90, 90];
      }
    }

    for (var i = 1; i <= 55; i++) {
      $.draggable_sizes["player_male_" + i] = [40, 40];
      $.draggable_sizes["player_female_" + i] = [40, 40];
    }

    $.draggable_sizes["player_male_2"] = [40, 40];
    $.draggable_sizes["player_male_7"] = [35, 30];
    $.draggable_sizes["player_male_12"] = $.draggable_sizes[
      "player_male_11"
    ] = $.draggable_sizes["player_male_31"] = $.draggable_sizes[
      "player_male_32"
    ] = [40, 40];
    $.draggable_sizes["player_male_15"] = $.draggable_sizes[
      "player_male_16"
    ] = $.draggable_sizes["player_male_39"] = $.draggable_sizes[
      "player_male_40"
    ] = [40, 40];
    $.draggable_sizes["player_male_20"] = $.draggable_sizes[
      "player_male_19"
    ] = $.draggable_sizes["player_male_24"] = $.draggable_sizes[
      "player_male_23"
    ] = [40, 40];

    // discs
    for (var i = 1; i <= 12; i++) {
      $.draggable_sizes["team1_disc_" + i] = [75, 75];
    }
    for (var i = 1; i <= 12; i++) {
      $.draggable_sizes["team2_disc_" + i] = [75, 75];
    }

    // GK Discs
    for (var i = 1; i <= 2; i++) {
      $.draggable_sizes["gk_disc_" + i] = [85, 85];
    }

    for (var i = 1; i <= 20; i++) {
      $.draggable_sizes["goalie_male_" + i] = [140, 160];
      $.draggable_sizes["goalie_female_" + i] = [140, 160];
    }
    for (var i = 21; i <= 24; i++) {
      $.draggable_sizes["goalie_male_" + i] = [210, 160];
      $.draggable_sizes["goalie_female_" + i] = [210, 160];
    }
    

    
    $.canvas.draggable = {
      defaults: {
        strokeStyle: "#ffffff",
        lineWidth: 6,
        lineJoin: "round",
      },
      hitAreaDefaults: {},
      setup: function () {
        $(document).on(
          "mousedown touchstart",
          ".draggable:not(.draggable-upgrade)",
          function (e) {
            e.stopPropagation();
            e.preventDefault();
            $.canvas.items.set(this, $(this).attr("id"), null, e);
          }
        );
        $(document).on("click", "#clone", function (e) {
          if ($(this).parent().hasClass("active")) {
            $(this).parent().removeClass("active");
            //destroy the current draggable...
            $.canvas.draggable.onEnd(e);
          } else {
            $(this).parent().addClass("active");
          }
          return false;
        });
      },
      init: function (obj, e) {
        this.currentBtn = obj;

        var mousePosition = $.canvas.getOffset(obj);
        $.canvas.items.current.startX = $.canvas.items.current.endX =
          mousePosition.x;
        $.canvas.items.current.startY = $.canvas.items.current.endY =
          mousePosition.y;

        $("#startDrag,#centerDrag,#endDrag").remove();
        var $objects = $.canvas.history.currentObjects();
        $.each($objects, function (i, item) {
          delete item.hasVisibleMarkers;
        });

        if ($(obj).hasClass("team_1") || $(obj).hasClass("team_2")) {
          $.canvas.items.current.team = $.canvas.draggable.clone_team = $(obj)
            .closest("ul")
            .data("team");
        } else {
          $.canvas.draggable.clone_team = null;
        }

        $this = this;
        $(document).on("mousemove touchmove", function (e) {
          $this.onMove(e);
        });

        $(document).on("mouseup touchend", function (e) {
          setTimeout(function () {
            if (
              e.type == "touchstart" ||
              e.type == "touchmove" ||
              e.type == "touchend" ||
              e.type == "touchcancel"
            ) {
              var touch =
                e.originalEvent.touches[0] || e.originalEvent.changedTouches[0];
              e.pageX = touch.pageX;
              e.pageY = touch.pageY;
            } else if (
              e.type == "mousedown" ||
              e.type == "mouseup" ||
              e.type == "mousemove" ||
              e.type == "mouseover" ||
              e.type == "mouseout" ||
              e.type == "mouseenter" ||
              e.type == "mouseleave"
            ) {
            }
            $this.onEnd(e);
          }, 500);
        });

        $this.onMove(e);
        if ($("#clone").parent().hasClass("active")) {
          this.noDragging = true;
        }
      },
      onEnd: function (e) {
        e.stopPropagation();
        e.preventDefault();
        if ($("#clone").parent().hasClass("active")) {
          this.onMove(e);
          if ($.canvas.draggable.clone_team) {
            $.canvas.items.current.team = $.canvas.draggable.clone_team;
          }
        }
        // render the item on to the pitch...
        var canvasOffset = $(".canvas:visible").offset();
        if (
          e.type == "touchstart" ||
          e.type == "touchmove" ||
          e.type == "touchend" ||
          e.type == "touchcancel"
        ) {
          var touch =
            e.originalEvent.touches[0] || e.originalEvent.changedTouches[0];
          e.pageX = touch.pageX;
          e.pageY = touch.pageY;
        } else if (
          e.type == "mousedown" ||
          e.type == "mouseup" ||
          e.type == "mousemove" ||
          e.type == "mouseover" ||
          e.type == "mouseout" ||
          e.type == "mouseenter" ||
          e.type == "mouseleave"
        ) {
        }

        if (
          e.pageX >= canvasOffset.left &&
          e.pageY >= canvasOffset.top &&
          e.pageX <= canvasOffset.left + $(".canvas:visible").width() &&
          e.pageY <= canvasOffset.top + $(".canvas:visible").height()
        ) {
          $.canvas.items.render($.canvas.items.current.type);
          $.canvas.reset();
        }

        if (!$("#clone").parent().hasClass("active")) {
          if (!$.canvas.items.previousClass) {
            $.canvas.items.set(
              $("#movement-navigation li:first a"),
              "drag_items",
              "init_click",
              e
            );
          } else {
            $.canvas.items.set(
              $.canvas.items.previousBtn,
              $.canvas.items.previousClass
            );
          }
        }

        this.noDragging = false;
      },
      onMove: function (e) {
        e.stopPropagation();
        e.preventDefault();
        if (
          e.type == "touchstart" ||
          e.type == "touchmove" ||
          e.type == "touchend" ||
          e.type == "touchcancel"
        ) {
          var touch =
            e.originalEvent.touches[0] || e.originalEvent.changedTouches[0];
          e.pageX = touch.pageX;
          e.pageY = touch.pageY;
        } else if (
          e.type == "mousedown" ||
          e.type == "mouseup" ||
          e.type == "mousemove" ||
          e.type == "mouseover" ||
          e.type == "mouseout" ||
          e.type == "mouseenter" ||
          e.type == "mouseleave"
        ) {
        }
        var mousePosition = $.canvas.getOffset(e);

        $.canvas.items.current.endX = mousePosition.x;
        $.canvas.items.current.endY = mousePosition.y;
        var canvasOffset = $(".canvas:visible").offset();
        $("body").addClass("moving");
        if (
          e.pageX >= canvasOffset.left &&
          e.pageY >= canvasOffset.top &&
          e.pageX <= canvasOffset.left + $(".canvas:visible").width() &&
          e.pageY <= canvasOffset.top + $(".canvas:visible").height()
        ) {
          $(".drag-helper").addClass("visible").addClass("enlarge");
        } else {
          $(".drag-helper").removeClass("visible").removeClass("enlarge");
        }

        $(".drag-helper").css({ top: e.pageY, left: e.pageX });
      },
      setDefaults: function (hitarea) {
        if (hitarea) {
          $.each(this.hitAreaDefaults, function (i, item) {
            $.canvas.object[i] = item;
          });
        } else {
          $.each(this.defaults, function (i, item) {
            $.canvas.object[i] = item;
          });
        }
      },
      updatePosition: function ($item, changedBy) {
        $item.endX += changedBy.x;
        $item.endY += changedBy.y;
        $item.cache = this.setCache($item, true);
      },
      getCoords: function ($item) {
        return $item.cache;
      },
      // chrome
      setCache: function ($item, update, object_id) {
        var zoomBy = 1 + $.canvas.zoomTracking / 10,
          $width = $.draggable_sizes[$item.type][0] * 10, // * 10 to allow for scale/pan feature
          $height = $.draggable_sizes[$item.type][1] * 10; // * 10 to allow for scale/pan feature
        if (!$item.cache) {
          var cache = {};
        } else {
          var cache = $item.cache;
        }
        //to set goal size according to pitch on canvas.
        var size_arr = setGoalSize(
          $.canvas.items.pitch.current,
          $item.type,
          $.canvas.size
        );
        if (size_arr.width) {
          cache.width = size_arr.width;
          cache.height = size_arr.height;
        } else {
          cache.width = $.draggable_sizes[$item.type][0];
          cache.height = $.draggable_sizes[$item.type][1];
        }
        cache.left = $item.endX - cache.width / 2;
        cache.right = $item.endX + cache.width / 2;
        cache.top = $item.endY - cache.height / 2;
        console.log(cache.top);

        cache.bottom = $item.endY + cache.height / 2;
        // new item
        if (!update) {
          if ($item.team && !$item.colours) {
            // cache kit colours...
            $item.colours = $.kitColours.defaults["team_" + $item.team];
          }

          if (
            $item.type.indexOf("goalpost") >= 0 ||
            $item.type.indexOf("goal_post") >= 0
          ) {
            var text = $("#" + $item.type + ":first .item-white .text");
            $("#" + $item.type + ":first .item-white .text").remove();
            var svg = $("#" + $item.type + ":first .item-white")
              .html()
              .trim();
            $("#" + $item.type + ":first .item-white").prepend(text);
          } else {
            var text = $("#" + $item.type + ":first .text");
            $("#" + $item.type + ":first .text").remove();
            var svg = $("#" + $item.type + ":first")
              .html()
              .trim();
            $("#" + $item.type + ":first").prepend(text);
          }

          if ($item.colours) {
            $("body").append('<div id="tmp-svg">' + svg + "</div>");
            $.kitColours.setColours("#tmp-svg", $item.colours);
            svg = $("#tmp-svg").html().trim();
            $("#tmp-svg").remove();
          }
          //console.log('**** Chrome ****');
          var img = new Image();
          img.width = $width;
          img.height = $height;
          /*condition to get color on refresh*/
          if (copy_object.color) {
            $item.color = copy_object.color;
          }

          /*Condition to change color of object on canvas by checking image color*/
          if ($item.color) {
            var svg = changeSvgColor($item, $item.color);
            //img.src = 'data:image/svg+xml;base64,'+window.btoa(svg);
          }
          if (
            JSON.stringify(copy_object) != "{}" &&
            copy_object.text &&
            copy_object.text != ""
          ) {
            $item.text = copy_object.text;
            $item.textID = copy_object.textID;
          }

          if (
            JSON.stringify(copy_object) != "{}" &&
            copy_object.abovename &&
            copy_object.abovename != ""
          ) {
            $item.abovename = copy_object.abovename;
          }

          if (
            JSON.stringify(copy_object) != "{}" &&
            copy_object.abovecomment &&
            copy_object.abovecomment != ""
          ) {
            $item.abovecomment = copy_object.abovecomment;
          }

          // text tool item color
          if ($item.text_tool_color) {
            var svg = changeSvgColor($item, $item.text_tool_color);
            cache.text_tool_color = $item.text_tool_color;
          } else {
            var text_tool_color = $(".text-tools-colors").css(
              "background-color"
            );
            if (
              text_tool_color &&
              ($item.type.indexOf("letter_") >= 0 ||
                $item.type.indexOf("number_") >= 0)
            ) {
              var svg = changeSvgColor($item, text_tool_color);
              cache.text_tool_color = text_tool_color;
            }
          }
          img.src = "data:image/svg+xml;base64," + window.btoa(svg);

          /*condition to draw 3d goal on canvas*/
          var type = $item.type;
          var type = type.split("_");

          /*condition to draw 2d goals on canvas*/
          if ($item.type.indexOf("net_top_") !== -1) {
            if (
              $.canvas.items.pitch.colour == "mono" ||
              $.canvas.items.pitch.colour == "plane-white"
            ) {
              var svg_url =
                baseURL +
                "/components/com_sessioncreatorv1/assets/2d_big_goals/" +
                type[2] +
                "_grey.svg";
              img.src = svg_url;
            } else {
              var svg_url =
                baseURL +
                "/components/com_sessioncreatorv1/assets/2d_big_goals/" +
                type[2] +
                ".svg";
              img.src = svg_url;
            }
          } else if ($item.type.indexOf("standq_2d_") !== -1) {
            if (
              $.canvas.items.pitch.colour == "mono" ||
              $.canvas.items.pitch.colour == "plane-white"
            ) {
              var svg_url =
                baseURL +
                "/components/com_sessioncreatorv1/assets/2d_mini_goals/" +
                type[2] +
                "_grey.svg";
              img.src = svg_url;
            } else {
              var svg_url =
                baseURL +
                "/components/com_sessioncreatorv1/assets/2d_mini_goals/" +
                type[2] +
                ".svg";
              img.src = svg_url;
            }
          } else {
          }
          /*condition to draw 3d goal on canvas*/
          if ($item.type.indexOf("goal_rotation_") !== -1) {
            if (
              $.canvas.items.pitch.colour == "mono" ||
              $.canvas.items.pitch.colour == "plane-white"
            ) {
              var svg_url =
                baseURL +
                "/components/com_sessioncreatorv1/assets/rotated-goals/" +
                type[2] +
                "_grey.svg";
              img.src = svg_url;
            } else {
              var svg_url =
                baseURL +
                "/components/com_sessioncreatorv1/assets/rotated-goals/" +
                type[2] +
                ".svg";
              img.src = svg_url;
            }
          } else if ($item.type.indexOf("standq_3d_") !== -1) {
            if (
              $.canvas.items.pitch.colour == "mono" ||
              $.canvas.items.pitch.colour == "plane-white"
            ) {
              var svg_url =
                baseURL +
                "/components/com_sessioncreatorv1/assets/small-rotated-goals/" +
                type[2] +
                "_grey.svg";
              img.src = svg_url;
            } else {
              var svg_url =
                baseURL +
                "/components/com_sessioncreatorv1/assets/small-rotated-goals/" +
                type[2] +
                ".svg";
              img.src = svg_url;
            }
          } else {
          }
          img.onload = function () {
            $.canvas.reset();
          };
          //}
          cache.img = img;

          // set bw image...
          // change colors for BW mode...
          if (
            $item.type.indexOf("goalpost") >= 0 ||
            $item.type.indexOf("goal_post") >= 0 ||
            $item.type.indexOf("stopwatch") >= 0
          ) {
            var svg = $("#" + $item.type + " .item-grey").clone();
            svg.find(".text").remove();
            var svg_str = svg.html().trim();
            if (
              navigator.userAgent.toLowerCase().indexOf("firefox") > -1 ||
              navigator.userAgent.toLowerCase().indexOf("msie") > -1 ||
              navigator.userAgent.toLowerCase().indexOf("trident") > -1
            ) {
              //Do Firefox-related activities
              $("body").append(
                '<canvas id="tmp-canvas" width="' +
                  $width +
                  '" height="' +
                  $height +
                  '">Your browser does not support HTML5 Canvas.</canvas>'
              );
              var $canvas_obj = $("#tmp-canvas")[0];
              console.log('canvg5')
              canvg("tmp-canvas", svg_str, {
                ignoreMouse: true,
                ignoreAnimation: true,
                ignoreDimensions: true,
                ignoreClear: true,
                scaleWidth: $width,
                scaleHeight: $height,
              });

              $("#tmp-canvas").remove();
              //convert it to a PNG image, and set it to the canvas...
              var dataURL = $canvas_obj.toDataURL(),
                img = new Image();
              img.src = dataURL;
              img.onload = function () {
                $.canvas.reset();
              };
            } else {
              var img = new Image();
              img.width = $width;
              img.height = $height;
              img.src = "data:image/svg+xml;base64," + window.btoa(svg_str);
              img.onload = function () {
                $.canvas.reset();
              };
            }
            cache.img_bw = img;
          }
        } else {
        }
        return cache;
      },
      draw: function ($item, $i) {
        // Should be overridden...
        this.setDefaults();
        $.canvas.object.setLineDash([]);
        if ($item.type.indexOf("player_circle_") > -1) {
          drawshape_players($item, $i, this);
          console.log("25?");
        } else {
          // $item.x_percent = calculateXPercent(
          //   $item.endX
          // );
          // $item.y_percent = calculateYPercent(
          //   $item.endY
          // );
          console.log($item)
          this._drawshape($item, $i);
          console.log("26?");
        }
        var $currentObjects = $.extend(
          true,
          [],
          $.canvas.history.currentObjects()
        );

        if (
          $currentObjects.length == 1 &&
          is_Collision.id == undefined &&
          check_right_click_popup == 0
        ) {
          check_right_click_popup = 1;
          $.dialog.confirm(
            {
              title: "Right Click?",
              description:
                "Right Click Drag and Drop items to add names, numbers, rotate and change colours.",
              cancelText: "OK",
              callback: function () {},
            },
            "right-click"
          );
        }
      },
      _drawshape: function ($item) {
        console.log("27?");
        var cache = $item.cache;
        var left = (calculateRevX($item.x_percent) || cache.left) - cache.width / 2;
        var top = (calculateRevY($item.y_percent) || cache.top);
        console.log("left =" + left)
        console.log("top =" + top)
        console.log("P_left =" + $item.x_percent)
        console.log("Ptop =" + $item.y_percent)
        if (cache && cache.img) {
          // change colors for BW mode...
          if (
            $.canvas.items.pitch.colour === "mono" &&
            ($item.type.indexOf("goalpost") >= 0 ||
              $item.type.indexOf("goal_post") >= 0)
          ) {
            $.canvas.object.drawImage(
              cache.img_bw,
              left,
              top,
              cache.width,
              cache.height
            );
          } else {
            if (
              navigator.appName == "Microsoft Internet Explorer" ||
              !!(
                navigator.userAgent.match(/Trident/) ||
                navigator.userAgent.match(/rv:11/)
              ) ||
              (typeof $.browser !== "undefined" && $.browser.msie == 1)
            ) {
              var cacheimg = new Image();
              cacheimg.src = cache.img.href;
              cacheimg.onload = function () {
                $.canvas.object.drawImage(
                  cache.img,
                  left,
                  top,
                  cache.width,
                  cache.height
                );
              };
            } else {
              $.canvas.object.drawImage(
                cache.img,
                left,
                top,
                cache.width,
                cache.height
              );
            }
          }
        }
      },
      drawHitArea: function ($item, canvas_id) {
        var $canvas = $(
          '<canvas width="' +
            $item.cache.width +
            '" height="' +
            $item.cache.height +
            '">Your browser does not support HTML5 Canvas.</canvas>'
        );
        $.canvas.object = $canvas[0].getContext("2d");
        // just create a rectangle of color...
        $.canvas.object.fillStyle = "#000";
        $.canvas.object.fillRect(0, 0, $item.cache.width, $item.cache.height);
        if (is_history == 1) {
          $.canvas.object = $("#" + canvas_id)[0].getContext("2d");
        } else {
          $.canvas.object = $(".canvas:visible")[0].getContext("2d");
        }

        // for now lets append it....

        return $canvas;
      },
      destroy: function () {
        delete this.currentBtn;
        delete this.noDragging;
        $(".drag-helper").remove();
        $("body, .canvas:visible").removeClass("moving");
        $(document).off("mousemove touchmove mouseup touchend");
        $("body").off("mousemove touchmove mouseup touchend");
      },
    };

    // Basic Extends...
    $.canvas.items.ladder = $.canvas.items.ladder_horizontal = $.canvas.items.ladder_2d = $.canvas.items.ball = $.canvas.items.flag_large = $.canvas.items.flag_small = $.canvas.items.flag = $.canvas.items.flag_right = $.canvas.items.yellow_flag_left = $.canvas.items.flag_3d = $.canvas.items.yellow_flag_right = $.canvas.items.vlctrafic = $.canvas.items.vlctrafic_yellow = $.canvas.items.red_circle_3d = $.canvas.items.blue_circle_3d = $.canvas.items.vlctrafic_2d = $.canvas.items.vlctrafic_2d_blue = $.canvas.items.red_circle = $.canvas.items.blue_circle = $.canvas.items.pipeline = $.canvas.items.black_pole = $.canvas.items.black_pole_2d = $.canvas.items.yellow_pole = $.canvas.items.yellow_pole_2d = $.canvas.items.green_pole = $.canvas.items.red_pole = $.canvas.items.model = $.canvas.items.model_2 = $.canvas.items.modelD1 = $.canvas.items.modelD2 = $.canvas.items.modelD3 = $.canvas.items.overhead_mannequin_2d = $.canvas.items.stand1 = $.canvas.items.stand2 = $.canvas.items.stand3 = $.canvas.items.stand4 = $.canvas.items.stand5 = $.canvas.items.stand6 = $.canvas.items.laddar = $.canvas.items.cicle6 = $.canvas.items.cicle2 = $.canvas.items.cicle3 = $.canvas.items.cicle4 = $.canvas.items.cicle5 = $.canvas.items.cone = $.canvas.items.cone_2d = $.canvas.items.blue_round = $.canvas.items.BL1 = $.canvas.items.BL2 = $.canvas.items.BL3 = $.canvas.items.boxD1 = $.canvas.items.boxD2 = $.canvas.items.boxD3 = $.canvas.items.yellowB1 = $.canvas.items.yellowB2 = $.canvas.items.yellowB3 = $.canvas.items.tabIMG2 = $.canvas.items.tabIMG1 = $.canvas.items.stand_a = $.canvas.items.stand_b = $.canvas.items.stand_c = $.canvas.items.stand_d = $.canvas.items.stand_e = $.canvas.items.stand_f = $.canvas.items.stand_g = $.canvas.items.stand_g_right = $.canvas.items.stand_h = $.canvas.items.stand_h_right = $.canvas.items.stand_i = $.canvas.items.stand_j = $.canvas.items.stand_k = $.canvas.items.stand_l = $.canvas.items.stand_m = $.canvas.items.stand_n = $.canvas.items.stand_q = $.canvas.items.standq_3d_1 = $.canvas.items.standq_3d_2 = $.canvas.items.standq_3d_3 = $.canvas.items.standq_3d_4 = $.canvas.items.standq_3d_5 = $.canvas.items.standq_3d_6 = $.canvas.items.standq_3d_7 = $.canvas.items.standq_3d_8 = $.canvas.items.standq_3d_9 = $.canvas.items.standq_3d_10 = $.canvas.items.standq_3d_11 = $.canvas.items.standq_3d_1_grey = $.canvas.items.standq_3d_2_grey = $.canvas.items.standq_3d_3_grey = $.canvas.items.standq_3d_4_grey = $.canvas.items.standq_3d_5_grey = $.canvas.items.standq_3d_6_grey = $.canvas.items.standq_3d_7_grey = $.canvas.items.standq_3d_8_grey = $.canvas.items.standq_3d_9_grey = $.canvas.items.standq_3d_10_grey = $.canvas.items.standq_3d_11_grey = $.canvas.items.stand_o = $.canvas.items.stand_p = $.canvas.items.tyre = $.canvas.items.tyre_3d = $.canvas.items.pole_yellow = $.canvas.items.pole_red = $.canvas.items.cone_yellow = $.canvas.items.cone_red = $.canvas.items.cone_blue = $.canvas.items.cone_orange = $.canvas.items.trianglecone_red = $.canvas.items.trianglecone_yellow = $.canvas.items.person_left = $.canvas.items.person = $.canvas.items.person_right = $.canvas.items.barrier_front = $.canvas.items.barrier_back = $.canvas.items.barrier_left = $.canvas.items.barrier_right = $.canvas.items.hurdle = $.canvas.items.hurdle_left = $.canvas.items.hurdle_right = $.canvas.items.goalpost_left = $.canvas.items.goalpost_right = $.canvas.items.goalpost_up = $.canvas.items.goalpost_down = $.canvas.items.goalpost_large_left = $.canvas.items.goalpost_large_right = $.canvas.items.goalpost_indoor_up = $.canvas.items.goalpost_indoor_down = $.canvas.items.goalpost_indoor_left = $.canvas.items.goalpost_indoor_right = $.canvas.items.goalpost_huge_up = $.canvas.items.goalpost_huge_down = $.canvas.items.goalpost_huge_left = $.canvas.items.goalpost_huge_left_white = $.canvas.items.goalpost_huge_right = $.canvas.items.goal_post_hgt_right = $.canvas.items.goal_post_hgt_left = $.canvas.items.net_front = $.canvas.items.net_top_1 = $.canvas.items.net_top_2 = $.canvas.items.net_top_3 = $.canvas.items.net_top_4 = $.canvas.items.net_top_5 = $.canvas.items.net_top_6 = $.canvas.items.net_top_1_grey = $.canvas.items.net_top_2_grey = $.canvas.items.net_top_3_grey = $.canvas.items.net_top_4_grey = $.canvas.items.net_top_5_grey = $.canvas.items.net_top_6_grey = $.canvas.items.standq_2d_1 = $.canvas.items.standq_2d_2 = $.canvas.items.standq_2d_3 = $.canvas.items.standq_2d_4 = $.canvas.items.standq_2d_5 = $.canvas.items.standq_2d_6 = $.canvas.items.standq_2d_1_grey = $.canvas.items.standq_2d_2_grey = $.canvas.items.standq_2d_3_grey = $.canvas.items.standq_2d_4_grey = $.canvas.items.standq_2d_5_grey = $.canvas.items.standq_2d_6_grey = $.canvas.items.net_front_white = $.canvas.items.net_left_white = $.canvas.items.net_back_white = $.canvas.items.net_right_white = $.canvas.items.goal_rotation_1 = $.canvas.items.goal_rotation_2 = $.canvas.items.goal_rotation_3 = $.canvas.items.goal_rotation_4 = $.canvas.items.goal_rotation_5 = $.canvas.items.goal_rotation_6 = $.canvas.items.goal_rotation_7 = $.canvas.items.goal_rotation_8 = $.canvas.items.goal_rotation_9 = $.canvas.items.goal_rotation_10 = $.canvas.items.goal_rotation_11 = $.canvas.items.goal_rotation_1_grey = $.canvas.items.goal_rotation_2_grey = $.canvas.items.goal_rotation_3_grey = $.canvas.items.goal_rotation_4_grey = $.canvas.items.goal_rotation_5_grey = $.canvas.items.goal_rotation_6_grey = $.canvas.items.goal_rotation_7_grey = $.canvas.items.goal_rotation_8_grey = $.canvas.items.goal_rotation_9_grey = $.canvas.items.goal_rotation_10_grey = $.canvas.items.goal_rotation_11_grey = $.canvas.items.football = $.canvas.items.sky_blue_disc = $.canvas.items.player_circle_1 = $.canvas.items.player_circle_2 = $.canvas.items.player_circle_3 = $.canvas.items.player_circle_4 = $.canvas.items.player_circle_5 = $.canvas.items.player_circle_6 = $.canvas.items.player_circle_7 = $.canvas.items.player_circle_8 = $.canvas.items.player_circle_81 = $.canvas.items.player_circle_9 = $.canvas.items.player_circle_10 = $.canvas.items.green_disc = $.canvas.items.yellow_disc = $.canvas.items.blue_disc = $.canvas.items.orange_disc = $.canvas.items.red_disc = $.canvas.items.majanta_disc = $.canvas.items.net_back = $.canvas.items.net_left = $.canvas.items.net_right = $.extend(
      true,
      {},
      $.canvas.draggable
    );

    for (var i = 1; i <= 55; i++) {
      $.canvas.items["player_male_" + i] = $.extend(
        true,
        {},
        $.canvas.draggable
      );
      $.canvas.items["player_female_" + i] = $.extend(
        true,
        {},
        $.canvas.draggable
      );
    }

    for (var i = 1; i <= 24; i++) {
      $.canvas.items["goalie_male_" + i] = $.extend(
        true,
        {},
        $.canvas.draggable
      );
      $.canvas.items["goalie_female_" + i] = $.extend(
        true,
        {},
        $.canvas.draggable
      );
    }

    for (var i = 0; i <= 9; i++) {
      $.canvas.items["number_" + i] = $.extend(true, {}, $.canvas.draggable);
    }

    // discs
    for (var i = 1; i <= 12; i++) {
      $.canvas.items["team1_disc_" + i] = $.extend(
        true,
        {},
        $.canvas.draggable
      );
    }

    for (var i = 1; i <= 12; i++) {
      $.canvas.items["team2_disc_" + i] = $.extend(
        true,
        {},
        $.canvas.draggable
      );
    }

    // GK disc draggable
    for (var i = 1; i <= 2; i++) {
      $.canvas.items["gk_disc_" + i] = $.extend(true, {}, $.canvas.draggable);
    }

    var alphabet = "abcdefghijklmnopqrstuvwxyz".split("");
    $.each(alphabet, function (i, $i) {
      $.canvas.items["letter_" + $i] = $.extend(true, {}, $.canvas.draggable);
    });

    $(function () {
      $.canvas.draggable.setup();
    });
  })(jQuery);
}

function draggable_sizes() {
  (function ($) {
    draggable_object = $.draggable_sizes = {
      ladder: [48, 116],
      ladder_horizontal: [116, 48],
      ladder_2d: [48, 116],
      ball: [50, 50],
      blue_round: [40, 30],
      flag_large: [56, 140],
      flag_small: [80, 100],
      flag: [54, 44],
      flag_3d: [24, 80],
      flag_right: [54, 44],
      yellow_flag_left: [54, 44],
      yellow_flag_right: [54, 44],
      vlctrafic: [29, 15],
      vlctrafic_yellow: [29, 15],
      red_circle_3d: [30, 30],
      blue_circle_3d: [30, 30],
      vlctrafic_2d: [29, 29],
      vlctrafic_2d_blue: [29, 29],
      red_circle: [30, 30],
      blue_circle: [30, 30],
      cone: [27, 27],
      cone_2d: [27, 27],
      pipeline: [10, 150],
      black_pole: [35, 70],
      black_pole_2d: [10, 40],
      yellow_pole: [15, 75],
      yellow_pole_2d: [35, 70],
      green_pole: [35, 70],
      red_pole: [35, 70],
      model: [35, 80],
      model_2: [60, 85],
      modelD1: [35, 80],
      modelD2: [35, 80],
      modelD3: [35, 80],
      overhead_mannequin_2d: [35, 21],

      stand1: [43, 30],
      stand2: [44, 30],
      stand3: [43, 30],
      stand4: [34, 20],
      stand5: [54, 30],
      stand6: [54, 30],

      laddar: [48, 65],
      cicle6: [90, 100],

      cicle2: [27, 21],
      cicle3: [27, 21],
      cicle4: [27, 21],
      cicle5: [27, 21],

      BL1: [40, 25],
      BL2: [80, 50],
      BL3: [40, 25],

      boxD1: [53, 43],
      boxD2: [60, 24],
      boxD3: [60, 24],

      yellowB1: [90, 30],
      yellowB2: [90, 30],
      yellowB3: [90, 30],

      stand_a: [110, 110],
      stand_b: [110, 110],
      stand_c: [120, 120],
      stand_d: [120, 120],
      stand_e: [80, 40],
      stand_f: [70, 40],
      stand_g: [110, 110],
      stand_g_right: [110, 110],
      stand_h: [110, 110],
      stand_h_right: [110, 110],
      stand_i: [90, 90],
      stand_j: [50, 100],
      stand_k: [50, 100],
      stand_l: [50, 100],
      stand_m: [50, 100],
      stand_n: [90, 90],
      stand_p: [90, 48],
      stand_o: [90, 50],
      stand_q: [50, 30],

      tabIMG2: [130, 90],
      tabIMG1: [130, 90],
      tyre: [40, 37],
      tyre_3d: [40, 37],

      pole_yellow: [24, 152],
      pole_red: [24, 152],
      cone_yellow: [57, 36],
      cone_red: [65, 40],
      cone_orange: [57, 36],
      cone_blue: [57, 36],
      trianglecone_red: [45, 68],
      trianglecone_yellow: [45, 68],
      person_left: [68, 142],
      person: [70, 136],
      person_right: [59, 142],
      barrier_front: [160, 47],
      barrier_back: [160, 55],
      barrier_left: [65, 106],
      barrier_right: [65, 106],
      hurdle: [151, 37],
      hurdle_left: [53, 80],
      hurdle_right: [56, 82],
      goalpost_left: [90, 176],
      goalpost_right: [90, 176],
      goalpost_up: [176, 90],
      goalpost_down: [176, 90],
      goalpost_large_left: [162, 322],
      goalpost_large_right: [162, 322],
      goalpost_indoor_left: [80, 120],
      goalpost_indoor_right: [80, 120],
      goalpost_indoor_up: [130, 80],
      goalpost_indoor_down: [140, 80],
      goalpost_huge_left: [180, 200],
      goalpost_huge_left_white: [200, 240],
      goalpost_huge_right: [180, 200],
      goalpost_huge_up: [275, 125],
      goalpost_huge_down: [260, 160],
      goal_post_hgt_right: [100, 225],
      goal_post_hgt_left: [100, 225],

      net_front: [185, 90],
      net_top_1: [135, 40],
      net_top_2: [90, 140],
      net_top_3: [40, 135],
      net_top_4: [135, 40],
      net_top_5: [40, 135],
      net_top_6: [90, 140],
      net_top_1_grey: [135, 40],
      net_top_2_grey: [90, 140],
      net_top_3_grey: [40, 135],
      net_top_4_grey: [135, 40],
      net_top_5_grey: [40, 135],
      net_top_6_grey: [90, 140],
      standq_2d_1: [82, 36],
      standq_2d_2: [59, 75],
      standq_2d_3: [36, 82],
      standq_2d_4: [82, 36],
      standq_2d_5: [36, 82],
      standq_2d_6: [59, 75],
      standq_2d_1_grey: [82, 36],
      standq_2d_2_grey: [59, 75],
      standq_2d_3_grey: [36, 82],
      standq_2d_4_grey: [82, 36],
      standq_2d_5_grey: [36, 82],
      standq_2d_6_grey: [59, 75],
      net_back: [120, 90],
      net_left: [70, 95],
      net_right: [70, 95],

      net_front_white: [120, 70],
      net_left_white: [70, 95],
      net_back_white: [120, 90],
      net_right_white: [70, 95],
      goal_rotation_1: [84, 165],
      goal_rotation_2: [185, 90],
      goal_rotation_3: [185, 90],
      goal_rotation_4: [185, 120],
      goal_rotation_5: [84, 165],
      goal_rotation_6: [185, 70],
      goal_rotation_7: [170, 185],
      goal_rotation_8: [91, 150],
      goal_rotation_9: [91, 150],
      goal_rotation_10: [102, 165],
      goal_rotation_11: [97, 165],
      goal_rotation_1_grey: [80, 180],
      goal_rotation_2_grey: [185, 90],
      goal_rotation_3_grey: [185, 90],
      goal_rotation_4_grey: [185, 120],
      goal_rotation_5_grey: [80, 180],
      goal_rotation_6_grey: [185, 70],
      goal_rotation_7_grey: [170, 185],
      goal_rotation_8_grey: [91, 150],
      goal_rotation_9_grey: [91, 150],
      goal_rotation_10_grey: [102, 165],
      goal_rotation_11_grey: [97, 165],
      standq_3d_1: [48, 62],
      standq_3d_2: [90, 53],
      standq_3d_3: [90, 38],
      standq_3d_4: [65, 55],
      standq_3d_5: [48, 62],
      standq_3d_6: [100, 52],
      standq_3d_7: [66, 75],
      standq_3d_8: [66, 66],
      standq_3d_9: [66, 75],
      standq_3d_10: [53, 62],
      standq_3d_11: [53, 62],
      standq_3d_1_grey: [48, 62],
      standq_3d_2_grey: [90, 53],
      standq_3d_3_grey: [90, 38],
      standq_3d_4_grey: [65, 55],
      standq_3d_5_grey: [48, 62],
      standq_3d_6_grey: [100, 52],
      standq_3d_7_grey: [66, 75],
      standq_3d_8_grey: [66, 66],
      standq_3d_9_grey: [66, 75],
      standq_3d_10_grey: [53, 62],
      standq_3d_11_grey: [53, 62],
      football: [30, 30],
      sky_blue_disc: [24, 26],
      player_circle_1: [40, 40],
      player_circle_2: [40, 40],
      player_circle_3: [40, 40],
      player_circle_4: [50, 40],
      player_circle_5: [50, 40],
      player_circle_6: [50, 40],
      player_circle_7: [50, 40],
      player_circle_8: [40, 40],
      player_circle_81: [40, 40],
      player_circle_9: [60, 40],
      player_circle_10: [60, 40],
      green_disc: [24, 26],
      yellow_disc: [24, 26],
      blue_disc: [24, 26],
      orange_disc: [24, 26],
      red_disc: [24, 26],
      majanta_disc: [24, 26],
      stopwatch: [172, 223],
      player_circle: [84, 96],
      player_circle_yellow: [34, 34],
      player_circle_green: [84, 84],
      player_triangle: [84, 96],
    };
    
    
    //Players
    for (var i = 1; i <= 55; i++) {
      $.draggable_sizes["player_male_" + i] = [40, 40];
      $.draggable_sizes["player_female_" + i] = [40, 40];
    }
    $.draggable_sizes["player_male_2"] = [40, 40];
    //$.draggable_sizes['player_male_4'] = [40, 40];
    //$.draggable_sizes['player_male_3'] = [40, 40];
    $.draggable_sizes["player_male_7"] = [35, 30];
    // $.draggable_sizes['player_male_7'] = [40, 30];
    $.draggable_sizes["player_male_12"] = $.draggable_sizes[
      "player_male_11"
    ] = $.draggable_sizes["player_male_31"] = $.draggable_sizes[
      "player_male_32"
    ] = [40, 40];
    $.draggable_sizes["player_male_15"] = $.draggable_sizes[
      "player_male_16"
    ] = $.draggable_sizes["player_male_39"] = $.draggable_sizes[
      "player_male_40"
    ] = [40, 40];
    $.draggable_sizes["player_male_20"] = $.draggable_sizes[
      "player_male_19"
    ] = $.draggable_sizes["player_male_24"] = $.draggable_sizes[
      "player_male_23"
    ] = [40, 40];

    // discs
    for (var i = 1; i <= 12; i++) {
      $.draggable_sizes["team1_disc_" + i] = [75, 75];
    }
    for (var i = 1; i <= 12; i++) {
      $.draggable_sizes["team2_disc_" + i] = [75, 75];
    }

    // GK Discs
    for (var i = 1; i <= 2; i++) {
      $.draggable_sizes["gk_disc_" + i] = [85, 85];
    }

    for (var i = 1; i <= 20; i++) {
      $.draggable_sizes["goalie_male_" + i] = [140, 160];
      $.draggable_sizes["goalie_female_" + i] = [140, 160];
    }
    for (var i = 21; i <= 24; i++) {
      $.draggable_sizes["goalie_male_" + i] = [210, 160];
      $.draggable_sizes["goalie_female_" + i] = [210, 160];
    }
    for (var i = 0; i <= 9; i++) {
      $.draggable_sizes["number_" + i] = [30, 30];
    }

    var alphabet = "abcdefghijklmnopqrstuvwxyz".split("");
    $.each(alphabet, function (i, $i) {
      $.draggable_sizes["letter_" + $i] = [30, 30];
    });
    $.canvas.draggable = {
      defaults: {
        strokeStyle: "#ffffff",
        lineWidth: 6,
        lineJoin: "round",
      },
      hitAreaDefaults: {},
      setup: function () {
        console.log(" case setup ");
        $(document).on(
          "mousedown touchstart",
          ".draggable:not(.draggable-upgrade)",
          function (e) {
            e.stopPropagation();
            e.preventDefault();
            $.canvas.items.set(this, $(this).attr("id"), null, e);
          }
        );
        $(document).on("click", "#clone", function (e) {
          if ($(this).parent().hasClass("active")) {
            $(this).parent().removeClass("active");
            //destroy the current draggable...
            $.canvas.draggable.onEnd(e);
          } else {
            $(this).parent().addClass("active");
          }
          return false;
        });
      },
      init: function (obj, e) {
        console.log(" case init first");
        this.currentBtn = obj;

        var mousePosition = $.canvas.getOffset(obj);
        $.canvas.items.current.startX = $.canvas.items.current.endX =
          mousePosition.x;
        $.canvas.items.current.startY = $.canvas.items.current.endY =
          mousePosition.y;

        $("#startDrag,#centerDrag,#endDrag").remove();
        var $objects = $.canvas.history.currentObjects();
        $.each($objects, function (i, item) {
          delete item.hasVisibleMarkers;
        });

        if ($(obj).hasClass("team_1") || $(obj).hasClass("team_2")) {
          $.canvas.items.current.team = $.canvas.draggable.clone_team = $(obj)
            .closest("ul")
            .data("team");
        } else {
          $.canvas.draggable.clone_team = null;
        }

        $this = this;
        $(document).on("mousemove touchmove", function (e) {
          $this.onMove(e);
        });
        $(document).on("mouseup touchend", function (e) {
          $this.onEnd(e);
        });

        $this.onMove(e);
        if ($("#clone").parent().hasClass("active")) {
          this.noDragging = true;
        }
      },
      onEnd: function (e) {
        e.stopPropagation();
        e.preventDefault();

        if ($("#clone").parent().hasClass("active")) {
          this.onMove(e);
          if ($.canvas.draggable.clone_team) {
            $.canvas.items.current.team = $.canvas.draggable.clone_team;
          }
        }
        if (
          e.type == "touchstart" ||
          e.type == "touchmove" ||
          e.type == "touchend" ||
          e.type == "touchcancel"
        ) {
          var touch =
            e.originalEvent.touches[0] || e.originalEvent.changedTouches[0];
          e.pageX = touch.pageX;
          e.pageY = touch.pageY;
        } else if (
          e.type == "mousedown" ||
          e.type == "mouseup" ||
          e.type == "mousemove" ||
          e.type == "mouseover" ||
          e.type == "mouseout" ||
          e.type == "mouseenter" ||
          e.type == "mouseleave"
        ) {
        }
        // render the item on to the pitch...
        var canvasOffset = $(".canvas:visible").offset();
        if (
          e.pageX >= canvasOffset.left &&
          e.pageY >= canvasOffset.top &&
          e.pageX <= canvasOffset.left + $(".canvas:visible").width() &&
          e.pageY <= canvasOffset.top + $(".canvas:visible").height()
        ) {
          $.canvas.items.render($.canvas.items.current.type);
          $.canvas.reset();
        }

        if (!$("#clone").parent().hasClass("active")) {
          if (!$.canvas.items.previousClass) {
            $.canvas.items.set(
              $("#movement-navigation li:first a"),
              "drag_items",
              "init_click",
              e
            );
          } else {
            $.canvas.items.set(
              $.canvas.items.previousBtn,
              $.canvas.items.previousClass
            );
          }
        }

        this.noDragging = false;
      },
      onMove: function (e) {
        if (
          e.type == "touchstart" ||
          e.type == "touchmove" ||
          e.type == "touchend" ||
          e.type == "touchcancel"
        ) {
          var touch =
            e.originalEvent.touches[0] || e.originalEvent.changedTouches[0];
          e.pageX = touch.pageX;
          e.pageY = touch.pageY;
        } else if (
          e.type == "mousedown" ||
          e.type == "mouseup" ||
          e.type == "mousemove" ||
          e.type == "mouseover" ||
          e.type == "mouseout" ||
          e.type == "mouseenter" ||
          e.type == "mouseleave"
        ) {
        }
        e.stopPropagation();
        e.preventDefault();
        var mousePosition = $.canvas.getOffset(e);
        $.canvas.items.current.endX = mousePosition.x;
        $.canvas.items.current.endY = mousePosition.y;
        var canvasOffset = $(".canvas:visible").offset();
        $("body").addClass("moving");
        if (
          e.pageX >= canvasOffset.left &&
          e.pageY >= canvasOffset.top &&
          e.pageX <= canvasOffset.left + $(".canvas:visible").width() &&
          e.pageY <= canvasOffset.top + $(".canvas:visible").height()
        ) {
          $(".drag-helper").addClass("visible").addClass("enlarge");
        } else {
          $(".drag-helper").removeClass("visible").removeClass("enlarge");
        }

        $(".drag-helper").css({ top: e.pageY, left: e.pageX });
      },
      setDefaults: function (hitarea) {
        if (hitarea) {
          $.each(this.hitAreaDefaults, function (i, item) {
            $.canvas.object[i] = item;
          });
        } else {
          $.each(this.defaults, function (i, item) {
            $.canvas.object[i] = item;
          });
        }
      },
      updatePosition: function ($item, changedBy) {
        $item.endX += changedBy.x;
        $item.endY += changedBy.y;
        $item.cache = this.setCache($item, true);
      },
      getCoords: function ($item) {
        return $item.cache;
      },
      // mozilla
      setCache: function ($item, update) {
        var zoomBy = 1 + $.canvas.zoomTracking / 10,
          $width = $.draggable_sizes[$item.type][0] * 10, // * 10 to allow for scale/pan feature
          $height = $.draggable_sizes[$item.type][1] * 10; // * 10 to allow for scale/pan feature
        if (!$item.cache) {
          var cache = {};
        } else {
          var cache = $item.cache;
        }
        // to set goal size according to pitch on canvas.
        var size_arr = setGoalSize(
          $.canvas.items.pitch.current,
          $item.type,
          $.canvas.size
        );
        if (size_arr.width) {
          cache.width = size_arr.width;
          cache.height = size_arr.height;
        } else {
          cache.width = $.draggable_sizes[$item.type][0];
          cache.height = $.draggable_sizes[$item.type][1];
        }
        cache.left = $item.endX - cache.width / 2;
        cache.right = $item.endX + cache.width / 2;
        cache.top = $item.endY - cache.height / 2;
        //  console.log(cache.top + " in moz");

        cache.bottom = $item.endY + cache.height / 2;
        if (!update) {
          if ($item.team && !$item.colours) {
            // cache kit colours...
            $item.colours = $.kitColours.defaults["team_" + $item.team];
          }

          if (
            $item.type.indexOf("goalpost") >= 0 ||
            $item.type.indexOf("goal_post") >= 0
          ) {
            var text = $("#" + $item.type + ":first .item-white .text");
            $("#" + $item.type + ":first .item-white .text").remove();
            var svg = $("#" + $item.type + ":first .item-white")
              .html()
              .trim();
            $("#" + $item.type + ":first .item-white").prepend(text);
          } else {
            var text = $("#" + $item.type + ":first .text");
            $("#" + $item.type + ":first .text").remove();
            var svg = $("#" + $item.type + ":first")
              .html()
              .trim();
            $("#" + $item.type + ":first").prepend(text);
          }

          if ($item.colours) {
            $("body").append('<div id="tmp-svg">' + svg + "</div>");
            $.kitColours.setColours("#tmp-svg", $item.colours);
            svg = $("#tmp-svg").html().trim();
            $("#tmp-svg").remove();
          }
          //console.log('*** Firefox ***'+svg);
          //Do Firefox-related activities
          $("body").append(
            '<canvas id="tmp-canvas" width="' +
              $width +
              '" height="' +
              $height +
              '">Your browser does not support HTML5 Canvas.</canvas>'
          );
          var $canvas_obj = $("#tmp-canvas")[0];
          // equipment item color
          if ($item.color) {
            var svg = changeSvgColor($item, $item.color);
          } else if (JSON.stringify(copy_object) != "{}" && copy_object.color) {
            var svg = changeSvgColor($item, copy_object.color);
            $item.color = copy_object.color;
          }
          //condition to retain Text option that comes inside head of players.
          if (
            JSON.stringify(copy_object) != "{}" &&
            copy_object.text &&
            copy_object.text != ""
          ) {
            $item.text = copy_object.text;
            $item.textID = copy_object.textID;
          }
          //condition to retain Text option that comes on head of players.
          if (
            JSON.stringify(copy_object) != "{}" &&
            copy_object.abovename &&
            copy_object.abovename != ""
          ) {
            $item.abovename = copy_object.abovename;
          }
          //condition to retain Text option that comes on head of players.
          if (
            JSON.stringify(copy_object) != "{}" &&
            copy_object.abovecomment &&
            copy_object.abovecomment != ""
          ) {
            $item.abovecomment = copy_object.abovecomment;
          }
          // text tool item color
          if ($item.text_tool_color) {
            var svg = changeSvgColor($item, $item.text_tool_color);
            cache.text_tool_color = $item.text_tool_color;
          } else {
            var text_tool_color = $(".text-tools-colors").css(
              "background-color"
            );
            if (
              text_tool_color &&
              ($item.type.indexOf("letter_") >= 0 ||
                $item.type.indexOf("number_") >= 0)
            ) {
              var svg = changeSvgColor($item, text_tool_color);
              cache.text_tool_color = text_tool_color;
            }
          }
          console.log('canvg6')

          canvg("tmp-canvas", svg, {
            ignoreMouse: true,
            ignoreAnimation: true,
            ignoreDimensions: true,
            ignoreClear: true,
            //scaleWidth: $width, // commented on 8 Dec, 2016
            //scaleHeight:$height // commented on 8 Dec, 2016
          });
          var dataURL = $canvas_obj.toDataURL(),
            img = new Image();
          var img = new Image();

          $("#tmp-canvas").remove();

          //convert it to a PNG image, and set it to the canvas...

          var svg = $("#" + $item.type + " svg");
          var type = $item.type;
          var type_arr = type.split("_");
          /*condition to draw 2d goals on canvas*/
          if ($item.type.indexOf("net_top_") !== -1) {
            if (
              $.canvas.items.pitch.colour == "mono" ||
              $.canvas.items.pitch.colour == "plane-white"
            ) {
              var svg_url =
                baseURL +
                "/components/com_sessioncreatorv1/assets/2d_big_goals/" +
                type_arr[2] +
                "_grey.svg";
              img.src = svg_url;
            } else {
              var svg_url =
                baseURL +
                "/components/com_sessioncreatorv1/assets/2d_big_goals/" +
                type_arr[2] +
                ".svg";
              img.src = svg_url;
            }
          } else if ($item.type.indexOf("standq_2d_") !== -1) {
            if (
              $.canvas.items.pitch.colour == "mono" ||
              $.canvas.items.pitch.colour == "plane-white"
            ) {
              var svg_url =
                baseURL +
                "/components/com_sessioncreatorv1/assets/2d_mini_goals/" +
                type_arr[2] +
                "_grey.svg";
              img.src = svg_url;
            } else {
              var svg_url =
                baseURL +
                "/components/com_sessioncreatorv1/assets/2d_mini_goals/" +
                type_arr[2] +
                ".svg";
              img.src = svg_url;
            }
          } else if ($item.type.indexOf("goal_rotation_") !== -1) {
            /*condition to draw 3d goal on canvas*/
            if (
              $.canvas.items.pitch.colour == "mono" ||
              $.canvas.items.pitch.colour == "plane-white"
            ) {
              var svg_url =
                baseURL +
                "/components/com_sessioncreatorv1/assets/rotated-goals/" +
                type_arr[2] +
                "_grey.svg";
              img.src = svg_url;
            } else {
              var svg_url =
                baseURL +
                "/components/com_sessioncreatorv1/assets/rotated-goals/" +
                type_arr[2] +
                ".svg";
              img.src = svg_url;
            }
          } else if ($item.type.indexOf("standq_3d_") !== -1) {
            if (
              $.canvas.items.pitch.colour == "mono" ||
              $.canvas.items.pitch.colour == "plane-white"
            ) {
              var svg_url =
                baseURL +
                "/components/com_sessioncreatorv1/assets/small-rotated-goals/" +
                type_arr[2] +
                "_grey.svg";
              img.src = svg_url;
            } else {
              var svg_url =
                baseURL +
                "/components/com_sessioncreatorv1/assets/small-rotated-goals/" +
                type_arr[2] +
                ".svg";
              img.src = svg_url;
            }
          } else {
            img.src = dataURL;
          }
          img.onload = function () {
            $.canvas.reset();
          };

          cache.img = img;

          // set bw image...
          // change colors for BW mode...
          if (
            $item.type.indexOf("goalpost") >= 0 ||
            $item.type.indexOf("goal_post") >= 0 ||
            $item.type.indexOf("stopwatch") >= 0
          ) {
            var svg = $("#" + $item.type + " .item-grey").clone();

            svg.find(".text").remove();
            var svg_str = svg.html().trim();
            if (
              navigator.userAgent.toLowerCase().indexOf("firefox") > -1 ||
              navigator.userAgent.toLowerCase().indexOf("msie") > -1 ||
              navigator.userAgent.toLowerCase().indexOf("trident") > -1
            ) {
              //Do Firefox-related activities
              $("body").append(
                '<canvas id="tmp-canvas" width="' +
                  $width +
                  '" height="' +
                  $height +
                  '">Your browser does not support HTML5 Canvas.</canvas>'
              );
              var $canvas_obj = $("#tmp-canvas")[0];
              console.log('canvg7')
              canvg("tmp-canvas", svg_str, {
                ignoreMouse: true,
                ignoreAnimation: true,
                ignoreDimensions: true,
                ignoreClear: true,
                scaleWidth: $width,
                scaleHeight: $height,
              });

              $("#tmp-canvas").remove();

              //convert it to a PNG image, and set it to the canvas...
              var dataURL = $canvas_obj.toDataURL(),
                img = new Image();

              img.src = dataURL;
              img.onload = function () {
                $.canvas.reset();
              };
            } else {
              var img = new Image();
              img.width = $width;
              img.height = $height;
              img.src = "data:image/svg+xml;base64," + window.btoa(svg_str);
              img.onload = function () {
                $.canvas.reset();
              };
            }
            cache.img_bw = img;
          }
        } else {
        }
        return cache;
      },
      draw: function ($item, $i) {
        // Should be overridden...
        this.setDefaults();
        $.canvas.object.setLineDash([]);
        if ($item.type.indexOf("player_circle_") > -1) {
          drawshape_players($item, $i, this);
          console.log("28?");
        } else {
          this._drawshape($item, $i);
          console.log("29?");
        }
        var $currentObjects = $.extend(
          true,
          [],
          $.canvas.history.currentObjects()
        );
        if (
          $currentObjects.length == 1 &&
          is_Collision.id == undefined &&
          check_right_click_popup == 0
        ) {
          $.dialog.confirm(
            {
              title: "Right Click?",
              description:
                "Right Click Drag and Drop items to add names, numbers, rotate and change colours.",
              cancelText: "OK",
              callback: function () {},
            },
            "right-click"
          );
        }
      },
      _drawshape: function ($item) {
        console.log("30?");
        var cache = $item.cache;

        if (cache && cache.img) {
          // change colors for BW mode...
          if (
            $.canvas.items.pitch.colour === "mono" &&
            ($item.type.indexOf("goalpost") >= 0 ||
              $item.type.indexOf("goal_post") >= 0)
          ) {
            $.canvas.object.drawImage(
              cache.img_bw,
              cache.left,
              cache.top,
              cache.width,
              cache.height
            );
          } else {
            console.log("render item");
            // $.canvas.object.drawImage(
            //   cache.img,
            //   cache.left,
            //   cache.top,
            //   cache.width,
            //   cache.height
            // );
            if ($item.x_percent == undefined) {
              var lefts = cache.left;
              var tops = cache.top;
            } else {
              console.log("*******************");
              var lefts = calculateRevX($item.x_percent) - cache.width / 2;
              var tops = calculateRevY($item.y_percent) - cache.height / 2;
              console.log(
                calculateRevY($item.y_percent) +
                  " calculateRevY($item.y_percent)"
              );
              console.log(
                calculateRevX($item.x_percent) +
                  "calculateRevX($item.x_percent)"
              );
              // var lefts = parseFloat(
              //   ($item.x_percent * $(".canvas:visible").width()) / 100
              // ); // - (cache.width/2);
              // var tops = parseFloat(
              //   ($item.y_percent * $(".canvas:visible").height()) / 100
              // ); // - parseFloat($("body").css("font-size").replace("px", "")) - 7;
            }
            $.canvas.object.drawImage(
              cache.img,
              lefts,
              tops,
              cache.width,
              cache.height
            );
          }
        }
      },
      drawHitArea: function ($item, canvas_id) {
        var $canvas = $(
          '<canvas width="' +
            $item.cache.width +
            '" height="' +
            $item.cache.height +
            '">Your browser does not support HTML5 Canvas.</canvas>'
        );
        $.canvas.object = $canvas[0].getContext("2d");

        // just create a rectangle of color...
        $.canvas.object.fillStyle = "#000";
        $.canvas.object.fillRect(0, 0, $item.cache.width, $item.cache.height);
        if (is_history == 1) {
          $.canvas.object = $("#" + canvas_id)[0].getContext("2d");
        } else {
          $.canvas.object = $(".canvas:visible")[0].getContext("2d");
        }

        // for now lets append it....
        return $canvas;
      },
      destroy: function () {
        delete this.currentBtn;
        delete this.noDragging;
        $(".drag-helper").remove();
        $("body, .canvas:visible").removeClass("moving");
        $(document).off("mousemove touchmove mouseup touchend");
        $("body").off("mousemove touchmove mouseup touchend");
      },
    };

    // Basic Extends...
    $.canvas.items.ladder = $.canvas.items.ladder_horizontal = $.canvas.items.ladder_2d = $.canvas.items.ball = $.canvas.items.flag_large = $.canvas.items.flag_small = $.canvas.items.flag = $.canvas.items.flag_3d = $.canvas.items.flag_right = $.canvas.items.yellow_flag_left = $.canvas.items.yellow_flag_right = $.canvas.items.vlctrafic = $.canvas.items.vlctrafic_yellow = $.canvas.items.red_circle_3d = $.canvas.items.blue_circle_3d = $.canvas.items.vlctrafic_2d = $.canvas.items.vlctrafic_2d_blue = $.canvas.items.red_circle = $.canvas.items.blue_circle = $.canvas.items.pipeline = $.canvas.items.black_pole = $.canvas.items.black_pole_2d = $.canvas.items.yellow_pole = $.canvas.items.yellow_pole_2d = $.canvas.items.green_pole = $.canvas.items.red_pole = $.canvas.items.model = $.canvas.items.model_2 = $.canvas.items.modelD1 = $.canvas.items.modelD2 = $.canvas.items.modelD3 = $.canvas.items.overhead_mannequin_2d = $.canvas.items.stand1 = $.canvas.items.stand2 = $.canvas.items.stand3 = $.canvas.items.stand4 = $.canvas.items.stand5 = $.canvas.items.stand6 = $.canvas.items.laddar = $.canvas.items.cicle6 = $.canvas.items.cicle2 = $.canvas.items.cicle3 = $.canvas.items.cicle4 = $.canvas.items.cicle5 = $.canvas.items.cone = $.canvas.items.cone_2d = $.canvas.items.blue_round = $.canvas.items.BL1 = $.canvas.items.BL2 = $.canvas.items.BL3 = $.canvas.items.boxD1 = $.canvas.items.boxD2 = $.canvas.items.boxD3 = $.canvas.items.yellowB1 = $.canvas.items.yellowB2 = $.canvas.items.yellowB3 = $.canvas.items.tabIMG2 = $.canvas.items.tabIMG1 = $.canvas.items.stand_a = $.canvas.items.stand_b = $.canvas.items.stand_c = $.canvas.items.stand_d = $.canvas.items.stand_e = $.canvas.items.stand_f = $.canvas.items.stand_g = $.canvas.items.stand_g_right = $.canvas.items.stand_h = $.canvas.items.stand_h_right = $.canvas.items.stand_i = $.canvas.items.stand_j = $.canvas.items.stand_k = $.canvas.items.stand_l = $.canvas.items.stand_m = $.canvas.items.stand_n = $.canvas.items.stand_q = $.canvas.items.standq_3d_1 = $.canvas.items.standq_3d_2 = $.canvas.items.standq_3d_3 = $.canvas.items.standq_3d_4 = $.canvas.items.standq_3d_5 = $.canvas.items.standq_3d_6 = $.canvas.items.standq_3d_7 = $.canvas.items.standq_3d_8 = $.canvas.items.standq_3d_9 = $.canvas.items.standq_3d_10 = $.canvas.items.standq_3d_11 = $.canvas.items.standq_3d_1_grey = $.canvas.items.standq_3d_2_grey = $.canvas.items.standq_3d_3_grey = $.canvas.items.standq_3d_4_grey = $.canvas.items.standq_3d_5_grey = $.canvas.items.standq_3d_6_grey = $.canvas.items.standq_3d_7_grey = $.canvas.items.standq_3d_8_grey = $.canvas.items.standq_3d_9_grey = $.canvas.items.standq_3d_10_grey = $.canvas.items.standq_3d_11_grey = $.canvas.items.goal_rotation_1 = $.canvas.items.goal_rotation_2 = $.canvas.items.goal_rotation_3 = $.canvas.items.goal_rotation_4 = $.canvas.items.goal_rotation_5 = $.canvas.items.goal_rotation_6 = $.canvas.items.goal_rotation_7 = $.canvas.items.goal_rotation_8 = $.canvas.items.goal_rotation_9 = $.canvas.items.goal_rotation_10 = $.canvas.items.goal_rotation_11 = $.canvas.items.goal_rotation_1_grey = $.canvas.items.goal_rotation_2_grey = $.canvas.items.goal_rotation_3_grey = $.canvas.items.goal_rotation_4_grey = $.canvas.items.goal_rotation_5_grey = $.canvas.items.goal_rotation_6_grey = $.canvas.items.goal_rotation_7_grey = $.canvas.items.goal_rotation_8_grey = $.canvas.items.goal_rotation_9_grey = $.canvas.items.goal_rotation_10_grey = $.canvas.items.goal_rotation_11_grey = $.canvas.items.stand_o = $.canvas.items.stand_p = $.canvas.items.tyre = $.canvas.items.tyre_3d = $.canvas.items.pole_yellow = $.canvas.items.pole_red = $.canvas.items.cone_yellow = $.canvas.items.cone_red = $.canvas.items.cone_blue = $.canvas.items.cone_orange = $.canvas.items.trianglecone_red = $.canvas.items.trianglecone_yellow = $.canvas.items.person_left = $.canvas.items.person = $.canvas.items.person_right = $.canvas.items.barrier_front = $.canvas.items.barrier_back = $.canvas.items.barrier_left = $.canvas.items.barrier_right = $.canvas.items.hurdle = $.canvas.items.hurdle_left = $.canvas.items.hurdle_right = $.canvas.items.goalpost_left = $.canvas.items.goalpost_right = $.canvas.items.goalpost_up = $.canvas.items.goalpost_down = $.canvas.items.goalpost_large_left = $.canvas.items.goalpost_large_right = $.canvas.items.goalpost_indoor_up = $.canvas.items.goalpost_indoor_down = $.canvas.items.goalpost_indoor_left = $.canvas.items.goalpost_indoor_right = $.canvas.items.goalpost_huge_up = $.canvas.items.goalpost_huge_down = $.canvas.items.goalpost_huge_left = $.canvas.items.goalpost_huge_left_white = $.canvas.items.goalpost_huge_right = $.canvas.items.goal_post_hgt_right = $.canvas.items.goal_post_hgt_left = $.canvas.items.net_front = $.canvas.items.net_top_1 = $.canvas.items.net_top_2 = $.canvas.items.net_top_3 = $.canvas.items.net_top_4 = $.canvas.items.net_top_5 = $.canvas.items.net_top_6 = $.canvas.items.net_top_1_grey = $.canvas.items.net_top_2_grey = $.canvas.items.net_top_3_grey = $.canvas.items.net_top_4_grey = $.canvas.items.net_top_5_grey = $.canvas.items.net_top_6_grey = $.canvas.items.standq_2d_1 = $.canvas.items.standq_2d_2 = $.canvas.items.standq_2d_3 = $.canvas.items.standq_2d_4 = $.canvas.items.standq_2d_5 = $.canvas.items.standq_2d_6 = $.canvas.items.standq_2d_1_grey = $.canvas.items.standq_2d_2_grey = $.canvas.items.standq_2d_3_grey = $.canvas.items.standq_2d_4_grey = $.canvas.items.standq_2d_5_grey = $.canvas.items.standq_2d_6_grey = $.canvas.items.net_front_white = $.canvas.items.net_left_white = $.canvas.items.net_back_white = $.canvas.items.net_right_white = $.canvas.items.football = $.canvas.items.sky_blue_disc = $.canvas.items.player_circle_1 = $.canvas.items.player_circle_2 = $.canvas.items.player_circle_3 = $.canvas.items.player_circle_4 = $.canvas.items.player_circle_5 = $.canvas.items.player_circle_6 = $.canvas.items.player_circle_7 = $.canvas.items.player_circle_8 = $.canvas.items.player_circle_81 = $.canvas.items.player_circle_9 = $.canvas.items.player_circle_10 = $.canvas.items.green_disc = $.canvas.items.yellow_disc = $.canvas.items.blue_disc = $.canvas.items.orange_disc = $.canvas.items.red_disc = $.canvas.items.majanta_disc = $.canvas.items.net_back = $.canvas.items.net_left = $.canvas.items.net_right = $.extend(
      true,
      {},
      $.canvas.draggable
    );

    for (var i = 1; i <= 55; i++) {
      $.canvas.items["player_male_" + i] = $.extend(
        true,
        {},
        $.canvas.draggable
      );
      $.canvas.items["player_female_" + i] = $.extend(
        true,
        {},
        $.canvas.draggable
      );
    }

    for (var i = 1; i <= 24; i++) {
      $.canvas.items["goalie_male_" + i] = $.extend(
        true,
        {},
        $.canvas.draggable
      );
      $.canvas.items["goalie_female_" + i] = $.extend(
        true,
        {},
        $.canvas.draggable
      );
    }

    for (var i = 0; i <= 9; i++) {
      $.canvas.items["number_" + i] = $.extend(true, {}, $.canvas.draggable);
    }

    // discs
    for (var i = 1; i <= 12; i++) {
      $.canvas.items["team1_disc_" + i] = $.extend(
        true,
        {},
        $.canvas.draggable
      );
    }

    for (var i = 1; i <= 12; i++) {
      $.canvas.items["team2_disc_" + i] = $.extend(
        true,
        {},
        $.canvas.draggable
      );
    }

    // GK disc draggable
    for (var i = 1; i <= 2; i++) {
      $.canvas.items["gk_disc_" + i] = $.extend(true, {}, $.canvas.draggable);
    }

    var alphabet = "abcdefghijklmnopqrstuvwxyz".split("");
    $.each(alphabet, function (i, $i) {
      $.canvas.items["letter_" + $i] = $.extend(true, {}, $.canvas.draggable);
    });

    $(function () {
      $.canvas.draggable.setup();
    });
  })(jQuery);
}

canvasFunctions();
function canvasFunctions() {
  (function ($) {
    $.canvas.draggable_text = $.extend(true, {}, $.canvas.draggable);
    $.canvas.draggable_text.fontSize = 22;
    $.canvas.draggable_text.maxlength = 4;
    $.canvas.draggable_text.defaultText = "30M";
    $.canvas.draggable_text.defaults = {
      strokeStyle: "#ffffff",
      lineWidth: 6,
      lineJoin: "round",
      font: 'bold 22px "Helvetica Neue", Helvetica, Arial',
      fillStyle: "#000000",
      textAlign: "center",
      textBaseline: "top",
    };
    $.canvas.draggable_text.onEnd = function (e) {
      //console.log('*** draggable_text.onEnd *** ');
      e.stopPropagation();
      e.preventDefault();
      if (
        e.type == "touchstart" ||
        e.type == "touchmove" ||
        e.type == "touchend" ||
        e.type == "touchcancel"
      ) {
        var touch =
          e.originalEvent.touches[0] || e.originalEvent.changedTouches[0];
        e.pageX = touch.pageX;
        e.pageY = touch.pageY;
      } else if (
        e.type == "mousedown" ||
        e.type == "mouseup" ||
        e.type == "mousemove" ||
        e.type == "mouseover" ||
        e.type == "mouseout" ||
        e.type == "mouseenter" ||
        e.type == "mouseleave"
      ) {
      }
      if ($("#clone").parent().hasClass("active")) {
        this.onMove(e);
        if ($.canvas.draggable.clone_team) {
          $.canvas.items.current.team = $.canvas.draggable.clone_team;
        }
      }

      // render the item on to the pitch...
      $.canvas.items.current.textID = $.stringRandom.generate();
      $.canvas.items.current.text = this.defaultText;
      $.canvas.items.current.abovename = this.defaultText; //added temporarily
      $.canvas.items.current.abovecomment = this.defaultText;
      $.canvas.items.current.pageX = Math.round(e.pageX);
      $.canvas.items.current.pageY = Math.round(e.pageY);

      var canvasOffset = $(".canvas:visible").offset();
      if (
        e.pageX >= canvasOffset.left &&
        e.pageY >= canvasOffset.top &&
        e.pageX <= canvasOffset.left + $(".canvas:visible").width() &&
        e.pageY <= canvasOffset.top + $(".canvas:visible").height()
      ) {
        $.canvas.items.render($.canvas.items.current.type);
        $.canvas.reset();
      }

      // if we're still over the button, we assume the user uses the non dragging technique, from the old flash version...
      if (!$("#clone").parent().hasClass("active")) {
        if (!$.canvas.items.previousClass) {
          $.canvas.items.set(
            $("#movement-navigation li:first a"),
            "drag_items",
            "init_click",
            e
          );
        } else {
          $.canvas.items.set(
            $.canvas.items.previousBtn,
            $.canvas.items.previousClass
          );
        }
      }
    };
    $.canvas.draggable_text.editText = function ($ID, $obj, e) {
      $("#canvas-text").blur();
      // Track text changes
      if ($obj.name == "above-name") {
        var originalText = $obj.abovename;
      } else if ($obj.name == "above-comment") {
        var originalText = $obj.abovecomment;
      } else {
        var originalText = $obj.text;
      }

      var slideno =
        parseInt(
          $(document).find(".slide-count span  span:eq(0) ").attr("prev-count")
        ) - parseInt(1);

      // remove text from canvas, and add to input element
      $objects = $.canvas.history.currentObjects();

      $objects[$ID].originalText = $obj.text;
      if ($obj.name == "above-name") {
        $objects[$ID].abovename = "";
      } else if ($obj.name == "above-comment") {
        $objects[$ID].abovecomment = "";
      } else {
        $objects[$ID].text = "";
      }

      $.canvas.reset();
      if ($obj.name == "above-name") {
        $(".canvas-content:eq(" + slideno + ")").append(
          '<input id="canvas-text" data-object="' +
            $ID +
            '" data-original="' +
            originalText +
            '" maxlength="' +
            this.namemaxlength +
            '" value="' +
            originalText +
            '">'
        );
      } else if ($obj.name == "above-comment") {
        $(".canvas-content:eq(" + slideno + ")").append(
          '<input id="canvas-text" data-object="' +
            $ID +
            '" data-original="' +
            originalText +
            '" maxlength="' +
            this.commentmaxlength +
            '" value="' +
            originalText +
            '">'
        );
      } else {
        let discText = this.maxlength - 1;
        // alert(discText)
        $(".canvas-content:eq(" + slideno + ")").append(
          '<input id="canvas-text" data-object="' +
            $ID +
            '" data-original="' +
            originalText +
            '" maxlength="2" value="' +
            originalText +
            '">'
        );
      }

      $("#canvas-text")
        .css({ color: $objects[$ID].color })
        .on("blur", function (e) {
          var $objects = $.canvas.history.currentObjects();
          if ($obj.name == "above-name") {
            $objects[$(this).data("object")].abovename = $(this).data(
              "original"
            );
          } else if ($obj.name == "above-comment") {
            $objects[$(this).data("object")].abovecomment = $(this).data(
              "original"
            );
          } else {
            $objects[$(this).data("object")].text = $(this).data("original");
          }
          if ($(this).val() !== $(this).data("original")) {
            var $objects = $.extend(
              true,
              [],
              $.canvas.history.currentObjects()
            );
            $.canvas.history.appendAll($objects);
            $objects = $.canvas.history.currentObjects();
            if ($obj.name == "above-name") {
              $objects[$(this).data("object")].abovename = $(this).val();
            } else if ($obj.name == "above-comment") {
              $objects[$(this).data("object")].abovecomment = $(this).val();
            } else {
              $objects[$(this).data("object")].text = $(this).val();
            }
          }
          $.canvas.history.doAutoSave();
          $(this).remove();
          $.canvas.reset();
        })
        .on("focus", function () {
          var $this = $(this);

          if ($objects[$ID].color) {
            if ($objects[$ID].name == "above-name") {
              if (
                $.canvas.items.pitch.colour == "mono" ||
                $.canvas.items.pitch.colour == "plane-white"
              ) {
                $(this).css("color", "#929292");
              } else {
                $(this).css("color", "#fff");
              }
            } else if ($objects[$ID].name == "above-comment") {
              if (
                $.canvas.items.pitch.colour == "mono" ||
                $.canvas.items.pitch.colour == "plane-white"
              ) {
                $(this).css("color", "#929292");
              } else {
                $(this).css("color", "#fff");
              }
            } else {
              if (
                // $objects[$ID].type == "player_circle_3" ||
                // $objects[$ID].type == "player_circle_6" ||
                $objects[$ID].type == "player_circle_7" ||
                $objects[$ID].type == "player_circle_8" ||
                $objects[$ID].type == "player_circle_81"
              ) {
                $(this).css("color", $objects[$ID].color);
              } else {
                $(this).css("color", "#fff");
              }
            }
          } else {
            if ($objects[$ID].name == "above-name") {
              if (
                $.canvas.items.pitch.colour == "mono" ||
                $.canvas.items.pitch.colour == "plane-white"
              ) {
                $(this).css("color", "#929292");
              } else {
                $(this).css("color", "#fff");
              }
            } else if ($objects[$ID].name == "above-comment") {
              if (
                $.canvas.items.pitch.colour == "mono" ||
                $.canvas.items.pitch.colour == "plane-white"
              ) {
                $(this).css("color", "#929292");
              } else {
                $(this).css("color", "#fff");
              }
            } else {
              if (
                // $objects[$ID].type == "player_circle_3" ||
                // $objects[$ID].type == "player_circle_6" ||
                $objects[$ID].type == "player_circle_7"
              ) {
                $(this).css("color", "#2A67B2");
              } else if (
                $objects[$ID].type == "player_circle_8" ||
                $objects[$ID].type == "player_circle_81"
              ) {
                $(this).css("color", "#EE220D");
              } else {
                $(this).css("color", "#fff");
              }
            }
          }
          $this.select();
          // Work around Chrome's little problem
          $this.mouseup(function () {
            // Prevent further mouseup intervention
            $this.unbind("mouseup touchend");
            return false;
          });
        })
        .focus();

      this.setTextPositionFromObject($("#canvas-text"));
    };
    $.canvas.draggable_text.setTextPositionFromObject = function ($obj) {
      var $objects = $.canvas.history.currentObjects();
      this.setTextPosition($objects[$obj.data("object")]);
    };
    $.canvas.draggable_text.setTextPosition = function ($item) {
      //console.log('*** setTextPosition ***');
      var $editableTextShape = $("#canvas-text"),
        zoomBy = 1 + $.canvas.zoomTracking / 10,
        offset = 3,
        padding = parseFloat($("body").css("font-size").replace("px", "")),
        x =
          ($item.cache.left / $.canvas.scaledRatio) * zoomBy +
          padding +
          $.canvas.panX,
        y =
          (($item.cache.top + $item.cache.height / 2) / $.canvas.scaledRatio) *
            zoomBy +
          padding -
          offset +
          $.canvas.panY,
        width = ($item.cache.width / $.canvas.scaledRatio) * zoomBy;

      if ($item.type == "player_circle_1" || $item.type == "player_circle_4") {
        if (
          navigator.userAgent.toLowerCase().indexOf("firefox") > -1 ||
          navigator.userAgent.toLowerCase().indexOf("msie") > -1 ||
          navigator.userAgent.toLowerCase().indexOf("trident") > -1
        ) {
          // firefox
          if ($item.name == "above-name") {
            $editableTextShape.css({
              "font-size": "20px",
              left: x - 11 + "px",
              top: y - 45 + "px",
              width: width + "px",
            });
          } else if ($item.name == "above-comment") {
            $editableTextShape.css({
              "font-size": "20px",
              left: x - 263 + "px",
              top: y - 75 + "px",
              width: width + 500 + "px",
            });
          } else {
            $editableTextShape.css({
              "font-size":
                (this.fontSize / $.canvas.scaledRatio) * zoomBy + "px",
              left: x - 12 + "px",
              top: y - 20 + "px",
              width: width + "px",
            });
          }
        } else if (navigator.appVersion.indexOf("Mac") > 0) {
          // MAC
          if ($item.name == "above-name") {
            $editableTextShape.css({
              "font-size": "20px",
              left: x - 11 + "px",
              top: y - 45 + "px",
              width: width + "px",
            });
          } else if ($item.name == "above-comment") {
            $editableTextShape.css({
              "font-size": "20px",
              left: x - 263 + "px",
              top: y - 75 + "px",
              width: width + 500 + "px",
            });
          } else {
            this.fontSize = 12;

            $editableTextShape.css({
              "font-size":
                (this.fontSize / $.canvas.scaledRatio) * zoomBy + "px",
              left: x - 11 + "px",
              top: y - 20 + "px",
              width: width + "px",
            });
          }
        } else {
          // chrome
          if ($item.name == "above-name") {
            $editableTextShape.css({
              "font-size": "10px",
              left: x - 11 + "px",
              top: y - 45 + "px",
              width: width + "px",
            });
          } else if ($item.name == "above-comment") {
            $editableTextShape.css({
              "font-size": "20px",
              left: x - 263 + "px",
              top: y - 75 + "px",
              width: width + 500 + "px",
            });
          } else {
            $editableTextShape.css({
              "font-size":
                (this.fontSize / $.canvas.scaledRatio) * zoomBy + "px",
              left: x - 11 + "px",
              top: y - 20 + "px",
              width: width + "px",
            });
          }
        }
      } else if (
        $item.type == "player_circle_2" ||
        $item.type == "player_circle_5" ||
        $item.type == "player_circle_9" ||
        $item.type == "player_circle_10"
      ) {
        if (
          navigator.userAgent.toLowerCase().indexOf("firefox") > -1 ||
          navigator.userAgent.toLowerCase().indexOf("msie") > -1 ||
          navigator.userAgent.toLowerCase().indexOf("trident") > -1
        ) {
          // firefox
          if ($item.name == "above-name") {
            $editableTextShape.css({
              "font-size": "20px",
              left: x - 11 + "px",
              top: y - 45 + "px",
              width: width + "px",
            });
          } else if ($item.name == "above-comment") {
            $editableTextShape.css({
              "font-size": "20px",
              left: x - 263 + "px",
              top: y - 75 + "px",
              width: width + 500 + "px",
            });
          } else {
            $editableTextShape.css({
              "font-size":
                (this.fontSize / $.canvas.scaledRatio) * zoomBy + "px",
              left: x - 12 + "px",
              top: y - 20 + "px",
              width: width + "px",
            });
          }
        } else if (navigator.appVersion.indexOf("Mac") > 0) {
          // MAC
          if ($item.name == "above-name") {
            $editableTextShape.css({
              "font-size": "20px",
              left: x - 11 + "px",
              top: y - 45 + "px",
              width: width + "px",
            });
          } else if ($item.name == "above-comment") {
            $editableTextShape.css({
              "font-size": "20px",
              left: x - 263 + "px",
              top: y - 75 + "px",
              width: width + 500 + "px",
            });
          } else {
            this.fontSize = 12;
            $editableTextShape.css({
              "font-size":
                (this.fontSize / $.canvas.scaledRatio) * zoomBy + "px",
              left: x - 11 + "px",
              top: y - 20 + "px",
              width: width + "px",
            });
          }
        } else {
          // chrome
          if ($item.name == "above-name") {
            $editableTextShape.css({
              "font-size": "20px",
              left: x - 11 + "px",
              top: y - 45 + "px",
              width: width + "px",
            });
          } else if ($item.name == "above-comment") {
            $editableTextShape.css({
              "font-size": "20px",
              left: x - 263 + "px",
              top: y - 75 + "px",
              width: width + 500 + "px",
            });
          } else {
            $editableTextShape.css({
              "font-size":
                (this.fontSize / $.canvas.scaledRatio) * zoomBy + "px",
              left: x - 11 + "px",
              top: y - 20 + "px",
              width: width + "px",
            });
          }
        }
      } else if (
        $item.type == "player_circle_3" ||
        $item.type == "player_circle_6" ||
        $item.type == "player_circle_8" ||
        $item.type == "player_circle_81"
      ) {
        if (
          navigator.userAgent.toLowerCase().indexOf("firefox") > -1 ||
          navigator.userAgent.toLowerCase().indexOf("msie") > -1 ||
          navigator.userAgent.toLowerCase().indexOf("trident") > -1
        ) {
          // firefox
          if ($item.name == "above-name") {
            $editableTextShape.css({
              "font-size": "20px",
              left: x - 11 + "px",
              top: y - 45 + "px",
              width: width + "px",
            });
          } else if ($item.name == "above-comment") {
            $editableTextShape.css({
              "font-size": "20px",
              left: x - 263 + "px",
              top: y - 75 + "px",
              width: width + 500 + "px",
            });
          } else {
            $editableTextShape.css({
              "font-size":
                (this.fontSize / $.canvas.scaledRatio) * zoomBy + "px",
              left: x - 12 + "px",
              top: y - 20 + "px",
              width: width + "px",
            });
          }
        } else if (navigator.appVersion.indexOf("Mac") > 0) {
          // MAC
          if ($item.name == "above-name") {
            $editableTextShape.css({
              "font-size": "20px",
              left: x - 11 + "px",
              top: y - 45 + "px",
              width: width + "px",
            });
          } else if ($item.name == "above-comment") {
            $editableTextShape.css({
              "font-size": "20px",
              left: x - 263 + "px",
              top: y - 75 + "px",
              width: width + 500 + "px",
            });
          } else {
            this.fontSize = 12;
            $editableTextShape.css({
              "font-size":
                (this.fontSize / $.canvas.scaledRatio) * zoomBy + "px",
              left: x - 11 + "px",
              top: y - 20 + "px",
              width: width + "px",
            });
          }
        } else {
          // chrome
          if ($item.name == "above-name") {
            $editableTextShape.css({
              "font-size": "10px",
              left: x - 11 + "px",
              top: y - 45 + "px",
              width: width + "px",
            });
          } else if ($item.name == "above-comment") {
            $editableTextShape.css({
              "font-size": "20px",
              left: x - 263 + "px",
              top: y - 75 + "px",
              width: width + 500 + "px",
            });
          } else {
            $editableTextShape.css({
              "font-size":
                (this.fontSize / $.canvas.scaledRatio) * zoomBy + "px",
              left: x - 11 + "px",
              top: y - 20 + "px",
              width: width + "px",
            });
          }
        }
      } else if ($item.type == "player_circle_7") {
        if (
          navigator.userAgent.toLowerCase().indexOf("firefox") > -1 ||
          navigator.userAgent.toLowerCase().indexOf("msie") > -1 ||
          navigator.userAgent.toLowerCase().indexOf("trident") > -1
        ) {
          // firefox
          if ($item.name == "above-name") {
            $editableTextShape.css({
              "font-size": "20px",
              left: x - 11 + "px",
              top: y - 45 + "px",
              width: width + "px",
            });
          } else if ($item.name == "above-comment") {
            $editableTextShape.css({
              "font-size": "20px",
              left: x - 263 + "px",
              top: y - 75 + "px",
              width: width + 500 + "px",
            });
          } else {
            $editableTextShape.css({
              "font-size":
                (this.fontSize / $.canvas.scaledRatio) * zoomBy + "px",
              left: x - 12 + "px",
              top: y - 20 + "px",
              width: width + "px",
            });
          }
        } else if (navigator.appVersion.indexOf("Mac") > 0) {
          // MAC
          if ($item.name == "above-name") {
            $editableTextShape.css({
              "font-size": "20px",
              left: x - 11 + "px",
              top: y - 45 + "px",
              width: width + "px",
            });
          } else if ($item.name == "above-comment") {
            $editableTextShape.css({
              "font-size": "20px",
              left: x - 263 + "px",
              top: y - 75 + "px",
              width: width + 500 + "px",
            });
          } else {
            this.fontSize = 12;
            $editableTextShape.css({
              "font-size":
                (this.fontSize / $.canvas.scaledRatio) * zoomBy + "px",
              left: x - 11 + "px",
              top: y - 20 + "px",
              width: width + "px",
            });
          }
        } else {
          // chrome
          if ($item.name == "above-name") {
            $editableTextShape.css({
              "font-size": "10px",
              left: x - 11 + "px",
              top: y - 45 + "px",
              width: width + "px",
            });
          } else if ($item.name == "above-comment") {
            $editableTextShape.css({
              "font-size": "20px",
              left: x - 263 + "px",
              top: y - 75 + "px",
              width: width + 500 + "px",
            });
          } else {
            $editableTextShape.css({
              "font-size":
                (this.fontSize / $.canvas.scaledRatio) * zoomBy + "px",
              left: x - 11 + "px",
              top: y - 20 + "px",
              width: width + "px",
            });
          }
        }
      } else {
        $editableTextShape.css({
          "font-size": (this.fontSize / $.canvas.scaledRatio) * zoomBy + "px",
          left: x + "px",
          top: y + "px",
          width: width + "px",
        });
      }
    };
    $.canvas.draggable_text._drawshape = function ($item, $i) {
      console.log("31?");
      var cache = $item.cache,
        offset = 5;
      if (cache && cache.img) {
        if (
          $.canvas.items.pitch.colour === "mono" &&
          $item.type.indexOf("stopwatch") >= 0
        ) {
          $.canvas.object.fillStyle = "#FFFFFF";
          $.canvas.object.drawImage(
            cache.img_bw,
            cache.left,
            cache.top,
            cache.width,
            cache.height
          );
        } else {
          $.canvas.object.drawImage(
            cache.img,
            cache.left,
            cache.top,
            cache.width,
            cache.height
          );
        }
        $.canvas.object.fillText(
          $item.text,
          cache.left + cache.width / 2,
          cache.top + cache.height / 2 - offset
        );

        this.setTextPosition($item);
      }
    };

    $.canvas.items.stopwatch = $.extend(true, {}, $.canvas.draggable_text);
    $.canvas.items.player_triangle = $.extend(
      true,
      {},
      $.canvas.draggable_text
    );
    $.canvas.items.player_triangle.namemaxlength = 15;
    $.canvas.items.player_triangle.commentmaxlength = 130;
    $.canvas.items.player_triangle.fontSize = 15;
    $.canvas.items.player_triangle.namefontSize = 20;
    $.canvas.items.player_triangle.commentfontSize = 12;
    $.canvas.items.player_triangle.maxlength = 3;
    // $.canvas.items.player_triangle.top = 300;
    //$.canvas.items.player_triangle.defaultText = '22';
    $.canvas.items.player_triangle.defaultText = "";
    $.canvas.items.player_triangle.defaults.font =
      'bold 19px "Helvetica Neue", Helvetica, Arial';
    $.canvas.items.player_triangle.defaults.fillStyle = "#FFFFFF";
    $.canvas.items.player_triangle._drawshape = function ($item, $i) {
      console.log("32?");
      var cache = $item.cache,
        offset = 5;
      if (cache && cache.img) {
        $.canvas.object.drawImage(
          cache.img,
          cache.left,
          cache.top,
          cache.width,
          cache.height
        );
        $.canvas.object.save();
        // apply text shadow...
        //$.canvas.object.shadowColor = "black";
        $.canvas.object.shadowOffsetX = 0;
        $.canvas.object.shadowOffsetY = 0;
        $.canvas.object.fillText(
          $item.text,
          cache.left + cache.width / 2,
          cache.top + cache.height / 2 - offset
        );
        $.canvas.object.restore();

        this.setTextPosition($item);
      }
    };

    $.canvas.items.player_circle = $.extend(
      true,
      {},
      $.canvas.items.player_triangle
    );
    $.canvas.items.player_circle._drawshape = function ($item, $i) {
      console.log("33?");
      var cache = $item.cache,
        offset = 5;

      if (cache && cache.img) {
        $.canvas.object.drawImage(
          cache.img,
          cache.left,
          cache.top,
          cache.width,
          cache.height
        );

        $.canvas.object.save();

        // apply text shadow...
        //$.canvas.object.shadowColor = "black";
        $.canvas.object.shadowOffsetX = 0;
        $.canvas.object.shadowOffsetY = 0;
        //$.canvas.object.shadowBlur = 10;
        $.canvas.object.fillText(
          $item.text,
          cache.left + cache.width / 2,
          cache.top - this.fontSize / 2 + cache.height / 2 - offset
        );

        $.canvas.object.restore();

        this.setTextPosition($item);
      }
    };
    $.canvas.items.player_circle.setTextPosition = function ($item) {
      var $editableTextShape = $("#canvas-text"),
        zoomBy = 1 + $.canvas.zoomTracking / 10,
        offset = 3,
        padding = parseFloat($("body").css("font-size").replace("px", "")),
        x =
          ($item.cache.left / $.canvas.scaledRatio) * zoomBy +
          padding +
          $.canvas.panX,
        y =
          (($item.cache.top - this.fontSize / 2 + $item.cache.height / 2) /
            $.canvas.scaledRatio) *
            zoomBy +
          padding -
          offset +
          $.canvas.panY,
        width = ($item.cache.width / $.canvas.scaledRatio) * zoomBy;

      $editableTextShape.css({
        "font-size": (this.fontSize / $.canvas.scaledRatio) * zoomBy + "px",
        left: x + "px",
        top: y + "px",
        width: width + "px",
      });
    };

    // player circle yellow
    $.canvas.items.player_circle_1 = $.extend(
      true,
      {},
      $.canvas.items.player_triangle
    );
    $.canvas.items.player_circle_2 = $.extend(
      true,
      {},
      $.canvas.items.player_triangle
    );
    $.canvas.items.player_circle_3 = $.extend(
      true,
      {},
      $.canvas.items.player_triangle
    );
    $.canvas.items.player_circle_4 = $.extend(
      true,
      {},
      $.canvas.items.player_triangle
    );
    $.canvas.items.player_circle_5 = $.extend(
      true,
      {},
      $.canvas.items.player_triangle
    );
    $.canvas.items.player_circle_6 = $.extend(
      true,
      {},
      $.canvas.items.player_triangle
    );
    $.canvas.items.player_circle_7 = $.extend(
      true,
      {},
      $.canvas.items.player_triangle
    );
    $.canvas.items.player_circle_8 = $.extend(
      true,
      {},
      $.canvas.items.player_triangle
    );
    $.canvas.items.player_circle_81 = $.extend(
      true,
      {},
      $.canvas.items.player_triangle
    );
    $.canvas.items.player_circle_9 = $.extend(
      true,
      {},
      $.canvas.items.player_triangle
    );
    $.canvas.items.player_circle_10 = $.extend(
      true,
      {},
      $.canvas.items.player_triangle
    );

    // player male 1
    $.canvas.items.player_male_1 = $.extend(
      true,
      {},
      $.canvas.items.player_triangle
    );
    $.canvas.items.player_male_1._drawshape = function ($item, $i) {
      console.log("34?");
      var cache = $item.cache,
        offset = 5;

      if (cache && cache.img) {
        if (
          navigator.appName == "Microsoft Internet Explorer" ||
          !!(
            navigator.userAgent.match(/Trident/) ||
            navigator.userAgent.match(/rv:11/)
          ) ||
          (typeof $.browser !== "undefined" && $.browser.msie == 1)
        ) {
          var cacheimg = new Image();
          cacheimg.src = cache.img.href;
          cacheimg.onload = function () {
            $.canvas.object.drawImage(
              cache.img,
              cache.left,
              cache.top,
              cache.width,
              cache.height
            );
          };
        } else {
          $.canvas.object.drawImage(
            cache.img,
            cache.left,
            cache.top,
            cache.width,
            cache.height
          );
        }
        $.canvas.object.save();

        // apply text shadow...
        $.canvas.object.shadowOffsetX = 0;
        $.canvas.object.shadowOffsetY = 0;

        if (
          navigator.userAgent.toLowerCase().indexOf("firefox") > -1 ||
          navigator.userAgent.toLowerCase().indexOf("msie") > -1 ||
          navigator.userAgent.toLowerCase().indexOf("trident") > -1
        ) {
          // firefox
          if ($item.text) {
            if ($item.color) {
              $.canvas.object.fillStyle = "#fff";
            } else {
              $.canvas.object.fillStyle = "#fff";
            }

            $.canvas.object.fillText(
              $item.text,
              cache.left + cache.width / 2,
              cache.top - this.fontSize / 2 + cache.height / 2 - offset + 12
            );
          }
          if ($item.abovename) {
            if (
              $.canvas.items.pitch.colour == "mono" ||
              $.canvas.items.pitch.colour == "plane-white"
            ) {
              $.canvas.object.fillStyle = "#929292";
            } else {
              $.canvas.object.fillStyle = "#fff";
            }
            //$.canvas.object.font='15px ProximaNovaA-Regular';
            $.canvas.object.font =
              '15px "Helvetica Neue", Helvetica, Arial, bold';
            $.canvas.object.fillText(
              $item.abovename,
              cache.left + cache.width / 2,
              cache.top - this.namefontSize / 2 + cache.height / 2 - offset - 35
            );
          }

          if ($item.abovecomment) {
            if (
              $.canvas.items.pitch.colour == "mono" ||
              $.canvas.items.pitch.colour == "plane-white"
            ) {
              $.canvas.object.fillStyle = "#929292";
            } else {
              $.canvas.object.fillStyle = "#fff";
            }

            $.canvas.object.font =
              '15px "Helvetica Neue", Helvetica, Arial, bold';

            var comment = $item.abovecomment;
            var split_comment = comment
              .replace(/.{30}\S*\s+/g, "$&@")
              .split(/\s+@/);
            var one = split_comment[0];
            var two = split_comment[1];
            var three = split_comment[2];
            var four = split_comment[3];

            if (two === undefined) {
              $.canvas.object.fillText(
                one,
                cache.left + cache.width / 2,
                cache.top -
                  15 -
                  this.commentfontSize / 2 +
                  cache.height / 2 -
                  offset -
                  35
              );
            } else if (three === undefined) {
              $.canvas.object.fillText(
                two,
                cache.left + cache.width / 2,
                cache.top -
                  15 -
                  this.commentfontSize / 2 +
                  cache.height / 2 -
                  offset -
                  35
              );
              $.canvas.object.fillText(
                one,
                cache.left + cache.width / 2,
                cache.top -
                  36 -
                  this.commentfontSize / 2 +
                  cache.height / 2 -
                  offset -
                  35
              );
            } else if (four === undefined) {
              $.canvas.object.fillText(
                three,
                cache.left + cache.width / 2,
                cache.top -
                  15 -
                  this.commentfontSize / 2 +
                  cache.height / 2 -
                  offset -
                  35
              );
              $.canvas.object.fillText(
                two,
                cache.left + cache.width / 2,
                cache.top -
                  36 -
                  this.commentfontSize / 2 +
                  cache.height / 2 -
                  offset -
                  35
              );
              $.canvas.object.fillText(
                one,
                cache.left + cache.width / 2,
                cache.top -
                  55 -
                  this.commentfontSize / 2 +
                  cache.height / 2 -
                  offset -
                  35
              );
            } else {
              $.canvas.object.fillText(
                four,
                cache.left + cache.width / 2,
                cache.top -
                  15 -
                  this.commentfontSize / 2 +
                  cache.height / 2 -
                  offset -
                  35
              );
              $.canvas.object.fillText(
                three,
                cache.left + cache.width / 2,
                cache.top -
                  36 -
                  this.commentfontSize / 2 +
                  cache.height / 2 -
                  offset -
                  35
              );
              $.canvas.object.fillText(
                two,
                cache.left + cache.width / 2,
                cache.top -
                  55 -
                  this.commentfontSize / 2 +
                  cache.height / 2 -
                  offset -
                  35
              );
              $.canvas.object.fillText(
                one,
                cache.left + cache.width / 2,
                cache.top -
                  75 -
                  this.commentfontSize / 2 +
                  cache.height / 2 -
                  offset -
                  35
              );
            }
          }
        } else {
          // chrome

          if ($item.text) {
            if ($item.color) {
              //$.canvas.object.fillStyle =  $item.color;
              $.canvas.object.fillStyle = "#fff";
            } else {
              $.canvas.object.fillStyle = "#fff";
            }

            $.canvas.object.fillText(
              $item.text,
              cache.left + cache.width / 2,
              cache.top - this.fontSize / 2 + cache.height / 2 - offset + 10
            );
          }
          if ($item.abovename) {
            if (
              $.canvas.items.pitch.colour == "mono" ||
              $.canvas.items.pitch.colour == "plane-white"
            ) {
              $.canvas.object.fillStyle = "#929292";
            } else {
              $.canvas.object.fillStyle = "#fff";
            }
            $.canvas.object.font =
              '15px "Helvetica Neue", Helvetica, Arial, bold';
            $.canvas.object.fillText(
              $item.abovename,
              cache.left + cache.width / 2,
              cache.top - this.namefontSize / 2 + cache.height / 2 - offset - 25
            );
          }

          if ($item.abovecomment) {
            if (
              $.canvas.items.pitch.colour == "mono" ||
              $.canvas.items.pitch.colour == "plane-white"
            ) {
              $.canvas.object.fillStyle = "#929292";
            } else {
              $.canvas.object.fillStyle = "#fff";
            }

            $.canvas.object.font =
              '15px "Helvetica Neue", Helvetica, Arial, bold';

            var comment = $item.abovecomment;
            var split_comment = comment
              .replace(/.{30}\S*\s+/g, "$&@")
              .split(/\s+@/);
            var one = split_comment[0];
            var two = split_comment[1];
            var three = split_comment[2];
            var four = split_comment[3];

            if (two === undefined) {
              $.canvas.object.fillText(
                one,
                cache.left + cache.width / 2,
                cache.top -
                  15 -
                  this.commentfontSize / 2 +
                  cache.height / 2 -
                  offset -
                  35
              );
            } else if (three === undefined) {
              $.canvas.object.fillText(
                two,
                cache.left + cache.width / 2,
                cache.top -
                  15 -
                  this.commentfontSize / 2 +
                  cache.height / 2 -
                  offset -
                  35
              );
              $.canvas.object.fillText(
                one,
                cache.left + cache.width / 2,
                cache.top -
                  36 -
                  this.commentfontSize / 2 +
                  cache.height / 2 -
                  offset -
                  35
              );
            } else if (four === undefined) {
              $.canvas.object.fillText(
                three,
                cache.left + cache.width / 2,
                cache.top -
                  15 -
                  this.commentfontSize / 2 +
                  cache.height / 2 -
                  offset -
                  35
              );
              $.canvas.object.fillText(
                two,
                cache.left + cache.width / 2,
                cache.top -
                  36 -
                  this.commentfontSize / 2 +
                  cache.height / 2 -
                  offset -
                  35
              );
              $.canvas.object.fillText(
                one,
                cache.left + cache.width / 2,
                cache.top -
                  55 -
                  this.commentfontSize / 2 +
                  cache.height / 2 -
                  offset -
                  35
              );
            } else {
              $.canvas.object.fillText(
                four,
                cache.left + cache.width / 2,
                cache.top -
                  15 -
                  this.commentfontSize / 2 +
                  cache.height / 2 -
                  offset -
                  35
              );
              $.canvas.object.fillText(
                three,
                cache.left + cache.width / 2,
                cache.top -
                  36 -
                  this.commentfontSize / 2 +
                  cache.height / 2 -
                  offset -
                  35
              );
              $.canvas.object.fillText(
                two,
                cache.left + cache.width / 2,
                cache.top -
                  55 -
                  this.commentfontSize / 2 +
                  cache.height / 2 -
                  offset -
                  35
              );
              $.canvas.object.fillText(
                one,
                cache.left + cache.width / 2,
                cache.top -
                  75 -
                  this.commentfontSize / 2 +
                  cache.height / 2 -
                  offset -
                  35
              );
            }
          }
        }

        $.canvas.object.restore();

        this.setTextPosition($item);
      }
    };

    $.canvas.items.player_male_1.setTextPosition = function ($item) {
      var $editableTextShape = $("#canvas-text"),
        zoomBy = 1 + $.canvas.zoomTracking / 10,
        offset = 3,
        padding = parseFloat($("body").css("font-size").replace("px", "")),
        x =
          ($item.cache.left / $.canvas.scaledRatio) * zoomBy +
          padding +
          $.canvas.panX,
        y =
          (($item.cache.top - this.fontSize / 2 + $item.cache.height / 2) /
            $.canvas.scaledRatio) *
            zoomBy +
          padding -
          offset +
          $.canvas.panY,
        width = ($item.cache.width / $.canvas.scaledRatio) * zoomBy;

      if ($item.name == "above-name") {
        $editableTextShape.css({
          "font-size": "15px",
          left: x - 11 + "px",
          top: y - 45 + "px",
          width: width + "px",
        });
      } else if ($item.name == "above-comment") {
        $editableTextShape.css({
          "font-size": "20px",
          left: x - 263 + "px",
          top: y - 61 + "px",
          width: width + 500 + "px",
        });
      } else {
        if (
          navigator.userAgent.toLowerCase().indexOf("firefox") > -1 ||
          navigator.userAgent.toLowerCase().indexOf("msie") > -1 ||
          navigator.userAgent.toLowerCase().indexOf("trident") > -1
        ) {
          $editableTextShape.css({
            "font-size": (this.fontSize / $.canvas.scaledRatio) * zoomBy + "px",
            left: x - 12 + "px",
            top: y - 2 + "px",
            width: width + "px",
          });
        } else if (navigator.appVersion.indexOf("Mac") > 0) {
          this.fontSize = 12;
          $editableTextShape.css({
            "font-size": (this.fontSize / $.canvas.scaledRatio) * zoomBy + "px",
            left: x - 11 + "px",
            top: y - 4 + "px",
            width: width + "px",
          });
        } else {
          $editableTextShape.css({
            "font-size": (this.fontSize / $.canvas.scaledRatio) * zoomBy + "px",
            left: x - 11 + "px",
            top: y - 5 + "px",
            width: width + "px",
          });
        }
      }
    };

    // player male 2(Birds Eye)
    $.canvas.items.player_male_2 = $.extend(
      true,
      {},
      $.canvas.items.player_triangle
    );
    $.canvas.items.player_male_2._drawshape = function ($item, $i) {
      console.log("35?");
      var cache = $item.cache,
        offset = 5;

      if (cache && cache.img) {
        if (
          navigator.appName == "Microsoft Internet Explorer" ||
          !!(
            navigator.userAgent.match(/Trident/) ||
            navigator.userAgent.match(/rv:11/)
          ) ||
          (typeof $.browser !== "undefined" && $.browser.msie == 1)
        ) {
          var cacheimg = new Image();
          cacheimg.src = cache.img.href;
          cacheimg.onload = function () {
            $.canvas.object.drawImage(
              cache.img,
              cache.left,
              cache.top,
              cache.width,
              cache.height
            );
          };
        } else {
          $.canvas.object.drawImage(
            cache.img,
            cache.left,
            cache.top,
            cache.width,
            cache.height
          );
        }
        $.canvas.object.save();

        // apply text shadow...
        //$.canvas.object.shadowColor = "black";
        $.canvas.object.shadowOffsetX = 0;
        $.canvas.object.shadowOffsetY = 0;
        //$.canvas.object.shadowBlur = 10;

        if (
          navigator.userAgent.toLowerCase().indexOf("firefox") > -1 ||
          navigator.userAgent.toLowerCase().indexOf("msie") > -1 ||
          navigator.userAgent.toLowerCase().indexOf("trident") > -1
        ) {
          // firefox
          if ($item.text) {
            if ($item.color) {
              //$.canvas.object.fillStyle =  $item.color;
              $.canvas.object.fillStyle = "#fff";
            } else {
              $.canvas.object.fillStyle = "#fff";
            }

            $.canvas.object.fillText(
              $item.text,
              cache.left + cache.width / 2,
              cache.top - this.fontSize / 2 + cache.height / 2 - offset + 12
            );
          }
          if ($item.abovename) {
            if (
              $.canvas.items.pitch.colour == "mono" ||
              $.canvas.items.pitch.colour == "plane-white"
            ) {
              $.canvas.object.fillStyle = "#929292";
            } else {
              $.canvas.object.fillStyle = "#fff";
            }
            $.canvas.object.font =
              '15px "Helvetica Neue", Helvetica, Arial, bold';
            $.canvas.object.fillText(
              $item.abovename,
              cache.left + cache.width / 2,
              cache.top - this.namefontSize / 2 + cache.height / 2 - offset - 35
            );
          }

          if ($item.abovecomment) {
            if (
              $.canvas.items.pitch.colour == "mono" ||
              $.canvas.items.pitch.colour == "plane-white"
            ) {
              $.canvas.object.fillStyle = "#929292";
            } else {
              $.canvas.object.fillStyle = "#fff";
            }

            $.canvas.object.font =
              '15px "Helvetica Neue", Helvetica, Arial, bold';

            var comment = $item.abovecomment;
            var split_comment = comment
              .replace(/.{30}\S*\s+/g, "$&@")
              .split(/\s+@/);
            var one = split_comment[0];
            var two = split_comment[1];
            var three = split_comment[2];
            var four = split_comment[3];

            if (two === undefined) {
              $.canvas.object.fillText(
                one,
                cache.left + cache.width / 2,
                cache.top -
                  15 -
                  this.commentfontSize / 2 +
                  cache.height / 2 -
                  offset -
                  35
              );
            } else if (three === undefined) {
              $.canvas.object.fillText(
                two,
                cache.left + cache.width / 2,
                cache.top -
                  15 -
                  this.commentfontSize / 2 +
                  cache.height / 2 -
                  offset -
                  35
              );
              $.canvas.object.fillText(
                one,
                cache.left + cache.width / 2,
                cache.top -
                  36 -
                  this.commentfontSize / 2 +
                  cache.height / 2 -
                  offset -
                  35
              );
            } else if (four === undefined) {
              $.canvas.object.fillText(
                three,
                cache.left + cache.width / 2,
                cache.top -
                  15 -
                  this.commentfontSize / 2 +
                  cache.height / 2 -
                  offset -
                  35
              );
              $.canvas.object.fillText(
                two,
                cache.left + cache.width / 2,
                cache.top -
                  36 -
                  this.commentfontSize / 2 +
                  cache.height / 2 -
                  offset -
                  35
              );
              $.canvas.object.fillText(
                one,
                cache.left + cache.width / 2,
                cache.top -
                  55 -
                  this.commentfontSize / 2 +
                  cache.height / 2 -
                  offset -
                  35
              );
            } else {
              $.canvas.object.fillText(
                four,
                cache.left + cache.width / 2,
                cache.top -
                  15 -
                  this.commentfontSize / 2 +
                  cache.height / 2 -
                  offset -
                  35
              );
              $.canvas.object.fillText(
                three,
                cache.left + cache.width / 2,
                cache.top -
                  36 -
                  this.commentfontSize / 2 +
                  cache.height / 2 -
                  offset -
                  35
              );
              $.canvas.object.fillText(
                two,
                cache.left + cache.width / 2,
                cache.top -
                  55 -
                  this.commentfontSize / 2 +
                  cache.height / 2 -
                  offset -
                  35
              );
              $.canvas.object.fillText(
                one,
                cache.left + cache.width / 2,
                cache.top -
                  75 -
                  this.commentfontSize / 2 +
                  cache.height / 2 -
                  offset -
                  35
              );
            }
          }
        } else {
          // chrome
          if ($item.text) {
            if ($item.color) {
              //$.canvas.object.fillStyle =  $item.color;
              $.canvas.object.fillStyle = "#fff";
            } else {
              $.canvas.object.fillStyle = "#fff";
            }
            $.canvas.object.fillText(
              $item.text,
              cache.left + cache.width / 2,
              cache.top - this.fontSize / 2 + cache.height / 2 - offset + 10
            );
          }
          if ($item.abovename) {
            if (
              $.canvas.items.pitch.colour == "mono" ||
              $.canvas.items.pitch.colour == "plane-white"
            ) {
              $.canvas.object.fillStyle = "#929292";
            } else {
              $.canvas.object.fillStyle = "#fff";
            }
            $.canvas.object.font =
              '15px "Helvetica Neue", Helvetica, Arial, bold';
            $.canvas.object.fillText(
              $item.abovename,
              cache.left + cache.width / 2,
              cache.top - this.namefontSize / 2 + cache.height / 2 - offset - 25
            );
          }

          if ($item.abovecomment) {
            if (
              $.canvas.items.pitch.colour == "mono" ||
              $.canvas.items.pitch.colour == "plane-white"
            ) {
              $.canvas.object.fillStyle = "#929292";
            } else {
              $.canvas.object.fillStyle = "#fff";
            }

            $.canvas.object.font =
              '15px "Helvetica Neue", Helvetica, Arial, bold';

            var comment = $item.abovecomment;
            var split_comment = comment
              .replace(/.{30}\S*\s+/g, "$&@")
              .split(/\s+@/);
            var one = split_comment[0];
            var two = split_comment[1];
            var three = split_comment[2];
            var four = split_comment[3];

            if (two === undefined) {
              $.canvas.object.fillText(
                one,
                cache.left + cache.width / 2,
                cache.top -
                  15 -
                  this.commentfontSize / 2 +
                  cache.height / 2 -
                  offset -
                  35
              );
            } else if (three === undefined) {
              $.canvas.object.fillText(
                two,
                cache.left + cache.width / 2,
                cache.top -
                  15 -
                  this.commentfontSize / 2 +
                  cache.height / 2 -
                  offset -
                  35
              );
              $.canvas.object.fillText(
                one,
                cache.left + cache.width / 2,
                cache.top -
                  36 -
                  this.commentfontSize / 2 +
                  cache.height / 2 -
                  offset -
                  35
              );
            } else if (four === undefined) {
              $.canvas.object.fillText(
                three,
                cache.left + cache.width / 2,
                cache.top -
                  15 -
                  this.commentfontSize / 2 +
                  cache.height / 2 -
                  offset -
                  35
              );
              $.canvas.object.fillText(
                two,
                cache.left + cache.width / 2,
                cache.top -
                  36 -
                  this.commentfontSize / 2 +
                  cache.height / 2 -
                  offset -
                  35
              );
              $.canvas.object.fillText(
                one,
                cache.left + cache.width / 2,
                cache.top -
                  55 -
                  this.commentfontSize / 2 +
                  cache.height / 2 -
                  offset -
                  35
              );
            } else {
              $.canvas.object.fillText(
                four,
                cache.left + cache.width / 2,
                cache.top -
                  15 -
                  this.commentfontSize / 2 +
                  cache.height / 2 -
                  offset -
                  35
              );
              $.canvas.object.fillText(
                three,
                cache.left + cache.width / 2,
                cache.top -
                  36 -
                  this.commentfontSize / 2 +
                  cache.height / 2 -
                  offset -
                  35
              );
              $.canvas.object.fillText(
                two,
                cache.left + cache.width / 2,
                cache.top -
                  55 -
                  this.commentfontSize / 2 +
                  cache.height / 2 -
                  offset -
                  35
              );
              $.canvas.object.fillText(
                one,
                cache.left + cache.width / 2,
                cache.top -
                  75 -
                  this.commentfontSize / 2 +
                  cache.height / 2 -
                  offset -
                  35
              );
            }
          }
        }

        $.canvas.object.restore();

        this.setTextPosition($item);
      }
    };
    $.canvas.items.player_male_2.setTextPosition = function ($item) {
      var $editableTextShape = $("#canvas-text"),
        zoomBy = 1 + $.canvas.zoomTracking / 10,
        offset = 3,
        padding = parseFloat($("body").css("font-size").replace("px", "")),
        x =
          ($item.cache.left / $.canvas.scaledRatio) * zoomBy +
          padding +
          $.canvas.panX,
        y =
          (($item.cache.top - this.fontSize / 2 + $item.cache.height / 2) /
            $.canvas.scaledRatio) *
            zoomBy +
          padding -
          offset +
          $.canvas.panY,
        width = ($item.cache.width / $.canvas.scaledRatio) * zoomBy;

      if (
        navigator.userAgent.toLowerCase().indexOf("firefox") > -1 ||
        navigator.userAgent.toLowerCase().indexOf("msie") > -1 ||
        navigator.userAgent.toLowerCase().indexOf("trident") > -1
      ) {
        // firefox
        if ($item.name == "above-name") {
          $editableTextShape.css({
            "font-size": "15px",
            left: x - 11 + "px",
            top: y - 45 + "px",
            width: width + "px",
          });
        } else if ($item.name == "above-comment") {
          $editableTextShape.css({
            "font-size": "20px",
            left: x - 263 + "px",
            top: y - 75 + "px",
            width: width + 500 + "px",
          });
        } else {
          $editableTextShape.css({
            "font-size": (this.fontSize / $.canvas.scaledRatio) * zoomBy + "px",
            left: x - 12 + "px",
            top: y - 1 + "px",
            width: width + "px",
          });
        }
      } else if (navigator.appVersion.indexOf("Mac") > 0) {
        // MAC
        if ($item.name == "above-name") {
          $editableTextShape.css({
            "font-size": "15px",
            left: x - 11 + "px",
            top: y - 45 + "px",
            width: width + "px",
          });
        } else if ($item.name == "above-comment") {
          $editableTextShape.css({
            "font-size": "20px",
            left: x - 263 + "px",
            top: y - 75 + "px",
            width: width + 500 + "px",
          });
        } else {
          this.fontSize = 12;
          $editableTextShape.css({
            "font-size": (this.fontSize / $.canvas.scaledRatio) * zoomBy + "px",
            left: x - 11 + "px",
            top: y - 4 + "px",
            width: width + "px",
          });
        }
      } else {
        // chrome
        if ($item.name == "above-name") {
          $editableTextShape.css({
            "font-size": "15px",
            left: x - 11 + "px",
            top: y - 45 + "px",
            width: width + "px",
          });
        } else if ($item.name == "above-comment") {
          $editableTextShape.css({
            "font-size": "20px",
            left: x - 263 + "px",
            top: y - 75 + "px",
            width: width + 500 + "px",
          });
        } else {
          $editableTextShape.css({
            "font-size": "10px",
            left: x - 11 + "px",
            top: y - 5 + "px",
            width: width + "px",
          });
        }
      }
    };

    // player male 3(player having grey border around face)
    $.canvas.items.player_male_7 = $.extend(
      true,
      {},
      $.canvas.items.player_triangle
    );
    $.canvas.items.player_male_7._drawshape = function ($item, $i) {
      console.log("36?");
      var cache = $item.cache,
        offset = 5;

      if (cache && cache.img) {
        if (
          navigator.appName == "Microsoft Internet Explorer" ||
          !!(
            navigator.userAgent.match(/Trident/) ||
            navigator.userAgent.match(/rv:11/)
          ) ||
          (typeof $.browser !== "undefined" && $.browser.msie == 1)
        ) {
          var cacheimg = new Image();
          cacheimg.src = cache.img.href;
          cacheimg.onload = function () {
            $.canvas.object.drawImage(
              cache.img,
              cache.left,
              cache.top,
              cache.width,
              cache.height
            );
          };
        } else {
          $.canvas.object.drawImage(
            cache.img,
            cache.left,
            cache.top,
            cache.width,
            cache.height
          );
        }
        $.canvas.object.save();

        // apply text shadow...
        //$.canvas.object.shadowColor = "black";
        $.canvas.object.shadowOffsetX = 0;
        $.canvas.object.shadowOffsetY = 0;
        //$.canvas.object.shadowBlur = 10;

        if (
          navigator.userAgent.toLowerCase().indexOf("firefox") > -1 ||
          navigator.userAgent.toLowerCase().indexOf("msie") > -1 ||
          navigator.userAgent.toLowerCase().indexOf("trident") > -1
        ) {
          // firefox
          if ($item.text) {
            if ($item.color) {
              $.canvas.object.fillStyle = $item.color;
            } else {
              $.canvas.object.fillStyle = "#fff";
            }
            $.canvas.object.fillText(
              $item.text,
              cache.left + cache.width / 2,
              cache.top - this.fontSize / 2 + cache.height / 2 - offset + 6
            );
          }
          if ($item.abovename) {
            if (
              $.canvas.items.pitch.colour == "mono" ||
              $.canvas.items.pitch.colour == "plane-white"
            ) {
              $.canvas.object.fillStyle = "#929292";
            } else {
              $.canvas.object.fillStyle = "#fff";
            }
            $.canvas.object.font =
              '15px "Helvetica Neue", Helvetica, Arial, bold';
            $.canvas.object.fillText(
              $item.abovename,
              cache.left + cache.width / 2,
              cache.top - this.namefontSize / 2 + cache.height / 2 - offset - 35
            );
          }

          if ($item.abovecomment) {
            if (
              $.canvas.items.pitch.colour == "mono" ||
              $.canvas.items.pitch.colour == "plane-white"
            ) {
              $.canvas.object.fillStyle = "#929292";
            } else {
              $.canvas.object.fillStyle = "#fff";
            }

            $.canvas.object.font =
              '15px "Helvetica Neue", Helvetica, Arial, bold';

            var comment = $item.abovecomment;
            var split_comment = comment
              .replace(/.{30}\S*\s+/g, "$&@")
              .split(/\s+@/);
            var one = split_comment[0];
            var two = split_comment[1];
            var three = split_comment[2];
            var four = split_comment[3];

            if (two === undefined) {
              $.canvas.object.fillText(
                one,
                cache.left + cache.width / 2,
                cache.top -
                  15 -
                  this.commentfontSize / 2 +
                  cache.height / 2 -
                  offset -
                  35
              );
            } else if (three === undefined) {
              $.canvas.object.fillText(
                two,
                cache.left + cache.width / 2,
                cache.top -
                  15 -
                  this.commentfontSize / 2 +
                  cache.height / 2 -
                  offset -
                  35
              );
              $.canvas.object.fillText(
                one,
                cache.left + cache.width / 2,
                cache.top -
                  36 -
                  this.commentfontSize / 2 +
                  cache.height / 2 -
                  offset -
                  35
              );
            } else if (four === undefined) {
              $.canvas.object.fillText(
                three,
                cache.left + cache.width / 2,
                cache.top -
                  15 -
                  this.commentfontSize / 2 +
                  cache.height / 2 -
                  offset -
                  35
              );
              $.canvas.object.fillText(
                two,
                cache.left + cache.width / 2,
                cache.top -
                  36 -
                  this.commentfontSize / 2 +
                  cache.height / 2 -
                  offset -
                  35
              );
              $.canvas.object.fillText(
                one,
                cache.left + cache.width / 2,
                cache.top -
                  55 -
                  this.commentfontSize / 2 +
                  cache.height / 2 -
                  offset -
                  35
              );
            } else {
              $.canvas.object.fillText(
                four,
                cache.left + cache.width / 2,
                cache.top -
                  15 -
                  this.commentfontSize / 2 +
                  cache.height / 2 -
                  offset -
                  35
              );
              $.canvas.object.fillText(
                three,
                cache.left + cache.width / 2,
                cache.top -
                  36 -
                  this.commentfontSize / 2 +
                  cache.height / 2 -
                  offset -
                  35
              );
              $.canvas.object.fillText(
                two,
                cache.left + cache.width / 2,
                cache.top -
                  55 -
                  this.commentfontSize / 2 +
                  cache.height / 2 -
                  offset -
                  35
              );
              $.canvas.object.fillText(
                one,
                cache.left + cache.width / 2,
                cache.top -
                  75 -
                  this.commentfontSize / 2 +
                  cache.height / 2 -
                  offset -
                  35
              );
            }
          }
        } else {
          // chrome

          if ($item.text) {
            if ($item.color) {
              // $.canvas.object.fillStyle =  $item.color;
              $.canvas.object.fillStyle = "#fff";
            } else {
              $.canvas.object.fillStyle = "#fff";
            }
            $.canvas.object.fillText(
              $item.text,
              cache.left + cache.width / 2,
              cache.top - this.fontSize / 2 + cache.height / 2 - offset + 2
            );
          }
          if ($item.abovename) {
            if (
              $.canvas.items.pitch.colour == "mono" ||
              $.canvas.items.pitch.colour == "plane-white"
            ) {
              $.canvas.object.fillStyle = "#929292";
            } else {
              $.canvas.object.fillStyle = "#fff";
            }
            $.canvas.object.font =
              '15px "Helvetica Neue", Helvetica, Arial, bold';
            $.canvas.object.fillText(
              $item.abovename,
              cache.left + cache.width / 2,
              cache.top - this.namefontSize / 2 + cache.height / 2 - offset - 25
            );
          }

          if ($item.abovecomment) {
            if (
              $.canvas.items.pitch.colour == "mono" ||
              $.canvas.items.pitch.colour == "plane-white"
            ) {
              $.canvas.object.fillStyle = "#929292";
            } else {
              $.canvas.object.fillStyle = "#fff";
            }

            $.canvas.object.font =
              '15px "Helvetica Neue", Helvetica, Arial, bold';

            var comment = $item.abovecomment;
            var split_comment = comment
              .replace(/.{30}\S*\s+/g, "$&@")
              .split(/\s+@/);
            var one = split_comment[0];
            var two = split_comment[1];
            var three = split_comment[2];
            var four = split_comment[3];

            if (two === undefined) {
              $.canvas.object.fillText(
                one,
                cache.left + cache.width / 2,
                cache.top -
                  15 -
                  this.commentfontSize / 2 +
                  cache.height / 2 -
                  offset -
                  35
              );
            } else if (three === undefined) {
              $.canvas.object.fillText(
                two,
                cache.left + cache.width / 2,
                cache.top -
                  15 -
                  this.commentfontSize / 2 +
                  cache.height / 2 -
                  offset -
                  35
              );
              $.canvas.object.fillText(
                one,
                cache.left + cache.width / 2,
                cache.top -
                  36 -
                  this.commentfontSize / 2 +
                  cache.height / 2 -
                  offset -
                  35
              );
            } else if (four === undefined) {
              $.canvas.object.fillText(
                three,
                cache.left + cache.width / 2,
                cache.top -
                  15 -
                  this.commentfontSize / 2 +
                  cache.height / 2 -
                  offset -
                  35
              );
              $.canvas.object.fillText(
                two,
                cache.left + cache.width / 2,
                cache.top -
                  36 -
                  this.commentfontSize / 2 +
                  cache.height / 2 -
                  offset -
                  35
              );
              $.canvas.object.fillText(
                one,
                cache.left + cache.width / 2,
                cache.top -
                  55 -
                  this.commentfontSize / 2 +
                  cache.height / 2 -
                  offset -
                  35
              );
            } else {
              $.canvas.object.fillText(
                four,
                cache.left + cache.width / 2,
                cache.top -
                  15 -
                  this.commentfontSize / 2 +
                  cache.height / 2 -
                  offset -
                  35
              );
              $.canvas.object.fillText(
                three,
                cache.left + cache.width / 2,
                cache.top -
                  36 -
                  this.commentfontSize / 2 +
                  cache.height / 2 -
                  offset -
                  35
              );
              $.canvas.object.fillText(
                two,
                cache.left + cache.width / 2,
                cache.top -
                  55 -
                  this.commentfontSize / 2 +
                  cache.height / 2 -
                  offset -
                  35
              );
              $.canvas.object.fillText(
                one,
                cache.left + cache.width / 2,
                cache.top -
                  75 -
                  this.commentfontSize / 2 +
                  cache.height / 2 -
                  offset -
                  35
              );
            }
          }
        }

        $.canvas.object.restore();

        this.setTextPosition($item);
      }
    };
    $.canvas.items.player_male_7.setTextPosition = function ($item) {
      var $editableTextShape = $("#canvas-text"),
        zoomBy = 1 + $.canvas.zoomTracking / 10,
        offset = 3,
        padding = parseFloat($("body").css("font-size").replace("px", "")),
        x =
          ($item.cache.left / $.canvas.scaledRatio) * zoomBy +
          padding +
          $.canvas.panX,
        y =
          (($item.cache.top - this.fontSize / 2 + $item.cache.height / 2) /
            $.canvas.scaledRatio) *
            zoomBy +
          padding -
          offset +
          $.canvas.panY,
        width = ($item.cache.width / $.canvas.scaledRatio) * zoomBy;

      if (
        navigator.userAgent.toLowerCase().indexOf("firefox") > -1 ||
        navigator.userAgent.toLowerCase().indexOf("msie") > -1 ||
        navigator.userAgent.toLowerCase().indexOf("trident") > -1
      ) {
        // firefox
        if ($item.name == "above-name") {
          $editableTextShape.css({
            "font-size": "15px",
            left: x - 11 + "px",
            top: y - 45 + "px",
            width: width + "px",
          });
        } else if ($item.name == "above-comment") {
          $editableTextShape.css({
            "font-size": "20px",
            left: x - 263 + "px",
            top: y - 75 + "px",
            width: width + 500 + "px",
          });
        } else {
          $editableTextShape.css({
            "font-size": (this.fontSize / $.canvas.scaledRatio) * zoomBy + "px",
            left: x - 12 + "px",
            top: y - 10 + "px",
            width: width + "px",
          });
        }
      } else if (navigator.appVersion.indexOf("Mac") > 0) {
        // MAC
        if ($item.name == "above-name") {
          $editableTextShape.css({
            "font-size": "15px",
            left: x - 11 + "px",
            top: y - 45 + "px",
            width: width + "px",
          });
        } else if ($item.name == "above-comment") {
          $editableTextShape.css({
            "font-size": "20px",
            left: x - 263 + "px",
            top: y - 75 + "px",
            width: width + 500 + "px",
          });
        } else {
          this.fontSize = 12;
          $editableTextShape.css({
            "font-size": (this.fontSize / $.canvas.scaledRatio) * zoomBy + "px",
            left: x - 11 + "px",
            top: y - 10 + "px",
            width: width + "px",
          });
        }
      } else {
        // chrome
        if ($item.name == "above-name") {
          $editableTextShape.css({
            "font-size": "15px",
            left: x - 11 + "px",
            top: y - 45 + "px",
            width: width + "px",
          });
        } else if ($item.name == "above-comment") {
          $editableTextShape.css({
            "font-size": "20px",
            left: x - 263 + "px",
            top: y - 75 + "px",
            width: width + 500 + "px",
          });
        } else {
          $editableTextShape.css({
            "font-size": (this.fontSize / $.canvas.scaledRatio) * zoomBy + "px",
            left: x - 11 + "px",
            top: y - 10 + "px",
            width: width + "px",
          });
        }
      }
    };
  })(jQuery);
  String.prototype.EncodeXMLEscapeChars = function () {
    var OutPut = this;
    if ($.trim(OutPut) != "") {
      //         OutPut = OutPut.replace(/</g, "&lt;").replace(/>/g, ">").replace(/"/g, """).replace(/'/g, "'");
      OutPut = OutPut.replace(
        /&(?!(amp;)|(lt;)|(gt;)|(quot;)|(#39;)|(apos;))/g,
        "&"
      );
      OutPut = OutPut.replace(/([^\\])((\\\\)*)\\(?![\\/{])/g, "$1\\\\$2"); //replaces odd backslash(\\) with even.
    } else {
      OutPut = "";
    }
    return OutPut;
  };

  (function ($) {
    $.importer = {
      playerIDs: {
        1: 1,
        2: 2,
        3: 3,
        4: 4,
        5: 5,
        6: 6,
        7: 8,
        8: 7,
        9: 10,
        10: 9,
        11: 19,
        12: 20,
        13: "triangle",
        14: 31,
        15: 11,
        16: 12,
        17: 14,
        18: 13,
        19: 15,
        20: 16,
        21: "circle",
        22: 17,
        23: 18,
        24: 9,
        25: 10,
        26: 10,
        27: 9,
        28: 21,
        29: 22,
        30: 23,
        31: 24,
        32: 25,
        33: 26,
        34: 27,
        35: 28,
        36: 29,
        37: 30,
        38: 31,
        39: 32,
      },
      item_names: {
        lofted: "loftedpass",
        adLine: "movementline",
        adLineOp: "movementline_opposition",
        running: "running",
        dribble: "dribble",
        pen: "pen",
        bend2: "bendpass",
        bend: "curledpass",
        pass: "pass",
        arc: "arc",
        arcOp: "arc_opposition",
        line: "basicline",
        line2: "shadow",
        circle: "circle",
        highlight: "circle_highlight",
        grid: "grid",
        perspective: "grid_perspective",
        cones: "cones_yellow",
        cones2: "cones_orange",
        movement: "movementline",
        movementOp: "movementline_opposition",

        ladderVertical: "ladder",
        ladderHorizontal: "ladder_horizontal",
        smallFlag: "flag_large",
        bigFlag: "flag_small",
        redCone: "cone_red",
        yellowCone2: "cone_yellow",
        blueCone: "cone_blue",
        orangeCone: "cone_orange",
        yellowPole: "pole_yellow",
        redPole: "pole_red",
        cone1: "trianglecone_red",
        yellowCone: "trianglecone_yellow",
        ball: "ball",

        prop1: "hurdle",
        prop2: "hurdle_left",
        prop3: "hurdle_right",

        goal3: "goalpost_down",
        goal4: "goalpost_left",
        goal5: "goalpost_up",
        goal6: "goalpost_right",

        goal4Big: "goalpost_large_left",
        goal6Big: "goalpost_large_right",

        goal: "goalpost_huge_left",
        goal_white: "goalpost_huge_left_white",
        goal2: "goalpost_huge_right",
        goal7: "goalpost_huge_down",
        goal9: "goalpost_huge_up",

        goal10: "goalpost_indoor_left",
        goal11: "goalpost_indoor_right",
        goal14: "goalpost_indoor_down",
        goal15: "goalpost_indoor_up",

        goal12: "net_front",
        football: "football",
        goal17: "net_right",
        goal16: "net_left",
        goal13: "net_back",

        staticPlayer2: "person_left",
        staticPlayer1: "person",
        staticPlayer3: "person_right",

        reboundLeft: "barrier_left",
        reboundFront: "barrier_front",
        reboundBack: "barrier_back",
        reboundRight: "barrier_right",

        clock: "stopwatch",
        textBtn: "textarea",

        gkc1: "goalie_male_9",
        gkc2: "goalie_male_10",
        gkc3: "goalie_male_3",
        gkc4: "goalie_male_4",
        gkc5: "goalie_male_13",
        gkc6: "goalie_male_15",
        gkc7: "goalie_male_16",
        gkc8: "goalie_male_12",
        gkc9: "goalie_male_11",
        gkc10: "goalie_male_14",
        gkc11: "goalie_male_22",
        gkc12: "goalie_male_21",
        gkc13: "goalie_male_6",
        gkc14: "goalie_male_5",
        gkc15: "goalie_male_2",
        gkc16: "goalie_male_1",
        gkc17: "goalie_male_8",
        gkc18: "goalie_male_23",
        gkc19: "goalie_male_24",
        gkc20: "goalie_male_7",
        gkc21: "goalie_male_19",
        gkc22: "goalie_male_20",
        gkc23: "goalie_male_17",

        gkcf1: "goalie_female_9",
        gkcf2: "goalie_female_10",
        gkcf3: "goalie_female_3",
        gkcf4: "goalie_female_4",
        gkcf5: "goalie_female_13",
        gkcf6: "goalie_female_15",
        gkcf7: "goalie_female_16",
        gkcf8: "goalie_female_12",
        gkcf9: "goalie_female_11",
        gkcf10: "goalie_female_14",
        gkcf11: "goalie_female_22",
        gkcf12: "goalie_female_21",
        gkcf13: "goalie_female_6",
        gkcf14: "goalie_female_5",
        gkcf15: "goalie_female_2",
        gkcf16: "goalie_female_1",
        gkcf17: "goalie_female_8",
        gkcf18: "goalie_female_23",
        gkcf19: "goalie_female_24",
        gkcf20: "goalie_female_7",
        gkcf21: "goalie_female_19",
        gkcf22: "goalie_female_20",
        gkcf23: "goalie_female_17",

        char0: "number_0",
        char1: "number_1",
        char2: "number_2",
        char3: "number_3",
        char4: "number_4",
        char5: "number_5",
        char6: "number_6",
        char7: "number_7",
        char8: "number_8",
        char9: "number_9",

        charA: "letter_a",
        charB: "letter_b",
        charC: "letter_c",
        charD: "letter_d",
        charE: "letter_e",
        charF: "letter_f",
        charG: "letter_g",
        charH: "letter_h",
        charI: "letter_i",
        charJ: "letter_j",
        charK: "letter_k",
        charL: "letter_l",
        charM: "letter_m",
        charN: "letter_n",
        charO: "letter_o",
        charP: "letter_p",
        charQ: "letter_q",
        charR: "letter_r",
        charS: "letter_s",
        charT: "letter_t",
        charU: "letter_u",
        charV: "letter_v",
        charW: "letter_w",
        charX: "letter_x",
        charY: "letter_y",
        charZ: "letter_z",
      },
      init: function () {
        $(".import-file input").bind(
          "mouseenter mouseleave mousedown touchstart mouseup touchend",
          function (e) {
            if ("mouseenter" === e.type) {
              $(".import-file a").addClass("hover");
            } else if ("mouseleave" === e.type) {
              $(".import-file a").removeClass("hover");
            }

            if ("mousedown" === e.type) {
              $(".import-file a").addClass("active");
            } else if ("mouseup" === e.type) {
              $(".import-file a").removeClass("active");
            }
          }
        );
      },
      params: {
        flashRatio: $.canvas.size.width / 530,
        //flashOffet: {x:33,y:51}
        //flashOffet: {x:23,y:46}
        flashOffet: { x: 0, y: 0 },
      },
      fromFlash: function () {
        var $html =
          '<textarea class="textarea full autosize" rows="8" id="xml" placeholder="Paste XML Here"></textarea>';

        $.modal.show({
          title: "Import ASC File",
          content: $html,
          openCallback: function () {
            $.formInputs.init();
            $.formInputs.submit();
            $.formAutosize.init();
          },
          callback: $.importer.doImport,
          actionText: "Import Data",
        });
      },
      handleFiles: function (files) {
        if (files && files.length) {
          var reader = new FileReader();
          reader.onload = function (event) {
            $.importer.doImport(event.target.result);
          };
          // when the file is read it triggers the onload event above.
          reader.readAsText(files[0]);
        }
        $("#import-form").get(0).reset();
      },
      setItem: function (item, flashImport, canvas_id, object_id) {
        if (!flashImport) {
          var $item = item;
        } else {
          actual = item.actualPos.trim().split(",");
          offsetX = parseFloat(actual[0] - $.importer.params.flashOffet.x);
          offsetY = parseFloat(actual[1] - $.importer.params.flashOffet.y);
          start = item.coords.line[0].trim().split(",");
          end = item.coords.line[1].trim().split(",");

          var $item = {
            type: $.importer.item_names[item.drawType],
            startX:
              Math.round(offsetX + parseFloat(start[0])) *
              $.importer.params.flashRatio,
            startY:
              Math.round(offsetY + parseFloat(start[1])) *
              $.importer.params.flashRatio,
            endX:
              Math.round(offsetX + parseFloat(end[0])) *
              $.importer.params.flashRatio,
            endY:
              Math.round(offsetY + parseFloat(end[1])) *
              $.importer.params.flashRatio,
          };
          switch (item.drawType) {
            case "adLine":
            case "adLineOp":
              end = item.coords.line[2].trim().split(",");
              $item.centerX = $item.endX;
              $item.centerY = $item.endY;
              $item.endX =
                Math.round(offsetX + parseFloat(end[0])) *
                $.importer.params.flashRatio;
              $item.endY =
                Math.round(offsetY + parseFloat(end[1])) *
                $.importer.params.flashRatio;
              $item.drawCurve = true; // ensures the arrow is angled correctly
              //code block
              break;
            case "arc":
            case "arcOp":
              $item.centerX = $item.endX;
              $item.centerY = $item.startY;
              break;
            case "bend":
              $item.centerX = $item.endX;
              $item.centerY = $item.startY;
              break;
            case "bend2":
              $item.centerX = $item.startX;
              $item.centerY = $item.endY;
              break;
            case "pen":
              start = item.coords.line[0].trim().split(",");
              end = item.coords.line[item.coords.line.length - 1]
                .trim()
                .split(",");
              $item = {
                type: "pen",
                startX:
                  Math.round(offsetX + parseFloat(start[0])) *
                  $.importer.params.flashRatio,
                startY:
                  Math.round(offsetY + parseFloat(start[1])) *
                  $.importer.params.flashRatio,
                endX:
                  Math.round(offsetX + parseFloat(end[0])) *
                  $.importer.params.flashRatio,
                endY:
                  Math.round(offsetY + parseFloat(end[1])) *
                  $.importer.params.flashRatio,
                points: [],
              };
              for (var i = 1; i < item.coords.line.length - 1; i++) {
                var point = item.coords.line[i].trim().split(",");
                $item.points.push({
                  x:
                    Math.round(offsetX + parseFloat(point[0])) *
                    $.importer.params.flashRatio,
                  y:
                    Math.round(offsetY + parseFloat(point[1])) *
                    $.importer.params.flashRatio,
                });
              }
              break;
          }
        }
        $item.cache = $.canvas.items[$item.type].setCache($item, "", object_id);
        $item.hitarea = $.canvas.items[$item.type].drawHitArea(
          $item,
          canvas_id
        );
        return $item;
      },
      convertColour: function (dec) {
        var hex = Number(dec).toString(16);
        if (hex.length === 1) {
          hex = "00000" + hex;
        } else if (hex.length === 2) {
          hex = "0000" + hex;
        } else if (hex.length === 3) {
          hex = "000" + hex;
        } else if (hex.length === 4) {
          hex = "00" + hex;
        } else if (hex.length === 5) {
          hex = "0" + hex;
        }
        return "#" + hex.toUpperCase();
      },
      setPlayer: function (item, flashImport) {
        if (!flashImport) {
          var $item = item;
        } else {
          coords = item.coords.trim().split(",");
          offsetX = parseFloat(coords[0] - $.importer.params.flashOffet.x);
          offsetY = parseFloat(coords[1] - $.importer.params.flashOffet.y);
          regex = /(\d+)/g;
          team = item.name.match(regex)[0] >= 40 ? 2 : 1;
          type = item.is_female
            ? "player_female_" + $.importer.playerIDs[item.pose]
            : "player_male_" + $.importer.playerIDs[item.pose];

          var $item = {
            type: type,
            team: team,
            colours: {
              shirt: {
                type: item.shirtStyle,
                base_colour: $.importer.convertColour(item.shirtColour1),
                stripe_colour: $.importer.convertColour(item.shirtColour2),
              },
              shorts: {
                type: item.shortsStyle,
                base_colour: $.importer.convertColour(item.shortsColour1),
                stripe_colour: $.importer.convertColour(item.shortsColour2),
              },
              socks: {
                type: item.socksStyle,
                base_colour: $.importer.convertColour(item.socksColour1),
                stripe_colour: $.importer.convertColour(item.socksColour2),
              },
              skin: $.importer.convertColour(item.skinColour),
            },
            startX: Math.round(offsetX) * $.importer.params.flashRatio,
            startY: Math.round(offsetY) * $.importer.params.flashRatio,
            endX: Math.round(offsetX) * $.importer.params.flashRatio,
            endY: Math.round(offsetY) * $.importer.params.flashRatio,
          };

          log($item);

          switch ($item.type) {
            case "player_circle":
            case "player_triangle":
              $item.text = item.number;
              break;
          }
        }

        $item.cache = $.canvas.items[$item.type].setCache($item);
        $item.hitarea = $.canvas.items[$item.type].drawHitArea(
          $item,
          $(".canvas:visible").attr("id")
        );
        return $item;
      },
      setItemD: function (item, flashImport) {
        if (!flashImport) {
          var $item = item;
        } else {
          coords = item.coords.trim().split(",");
          offsetX = parseFloat(coords[0] - $.importer.params.flashOffet.x);
          offsetY = parseFloat(coords[1] - $.importer.params.flashOffet.y);

          var $item = {
            type: $.importer.item_names[item.name],
            startX: Math.round(offsetX) * $.importer.params.flashRatio,
            startY: Math.round(offsetY) * $.importer.params.flashRatio,
            endX: Math.round(offsetX) * $.importer.params.flashRatio,
            endY: Math.round(offsetY) * $.importer.params.flashRatio,
          };

          switch (item.name) {
            case "clock":
            case "textBtn":
              $item.textID = $.stringRandom.generate();
              $item.text = item.text[0];
              $item.abovename = item.abovename[0];
              break;
          }
        }

        $item.cache = $.canvas.items[$item.type].setCache($item);
        $item.hitarea = $.canvas.items[$item.type].drawHitArea(
          $item,
          $(".canvas:visible").attr("id")
        );
        return $item;
      },
      doImport: function (data) {
        try {
          is_history = 1;
          var json_all_new = {};
          var json_all = (json = JSON.parse(data));
          var site_url = baseURL;
          var keys = [];
          for (var k in json_all) {
            if (json_all.hasOwnProperty(k)) {
              keys.push(k);
            }
          }
          keys.sort();
          for (var i = 0; i < keys.length; i++) {
            k = keys[i];
            json_all_new[k] = json_all[k];
          }

          var count_canvas = 1;
          var containerHeight = $(".creating-session").outerHeight();
          var headerHeight = $(".header-part").outerHeight();
          var footerHeight = $(".footer-part").outerHeight();
          var totalOfHeaderFooter = headerHeight + footerHeight;
          var finalHeight = containerHeight - totalOfHeaderFooter;
          $("#canvas_1").parent(".canvas-content").remove();
          $("#canvas-wrapper").html("");
          //first remove all images
          $(".footer-section-2").find(".image-slide-show").remove();
          $.each(json_all_new, function (canvas_id, json) {
            if (canvas_id != "undefined") {
              $("#canvas-wrapper").append(
                '<div  class="canvas-content"><canvas ref-canvas="' +
                  count_canvas +
                  '" id="canvas_' +
                  count_canvas +
                  '" class="canvas" width="1960" height="' +
                  finalHeight +
                  '">Your browser does not support HTML5 Canvas.</canvas><div class="divider height20">&nbsp;</div></div>'
              );
              var canvas = document.querySelector("#canvas_" + count_canvas);
              fitToContainer(canvas);
              next_click = 1;
              setCanvas("canvas_" + count_canvas);
              canvas_state[count_canvas] = $.canvas;
              // get practice information from history.
              if (canvas_id != "canvas_1") {
                // create clones for practices if canvas is not first.
                if (json.practice_infomation) {
                  create_practice_notes(count_canvas, json.practice_infomation);
                } else {
                  create_practice_notes(count_canvas);
                }
              } else {
                $(".practices_infomation").val("");
                // set practice information values for canvas_1
                $(".practice_canvas_" + count_canvas)
                  .find(".practices_infomation")
                  .each(function () {
                    var ref_name = $(this).attr("ref-name");
                    if (json.practice_infomation) {
                      if (json.practice_infomation[ref_name]) {
                        $(this).val(json.practice_infomation[ref_name]);
                      }
                    }
                  });
              }
              count_canvas++;
              if (!json) {
                $.dialog.alert({
                  title: "Load .asc File",
                  description:
                    "Unable to load file. File may be corrupt, or formatted incorrectly.",
                });
                return;
              }

              // render the pitch
              if (!flashImport) {
                $.canvas.items.pitch.colour = json.pitch_colour;
                $.canvas.items.pitch.set(json.pitch);
                set_default_lines_color_on_pitch($.canvas.items.pitch.colour);
              } else {
                var pitchCols = { "": "colour", w: "mono", bw: "greyscale" },
                  regex = /(\d+)/g,
                  pitchNumber = json.pitch.match(regex)[0],
                  pitchColour = json.pitch.replace("pitch" + pitchNumber, "");
                $.canvas.items.pitch.colour = pitchCols[pitchColour];
                $.canvas.items.pitch.set("pitch_" + pitchNumber);
              }

              // Set pitch zoom & offset...
              if (!flashImport) {
                $.canvas.zoomTracking = json.zoomTracking;
                $.canvas.panX = json.panX / $.canvas.scaledRatio;
                $.canvas.panY = json.panY / $.canvas.scaledRatio;
              } else {
                $.canvas.zoomTracking = parseInt(json.pitchScale * 10 - 10);
                var offset = json.pitchPosition.split(",");
                $.canvas.panX =
                  (offset[0] * $.importer.params.flashRatio) /
                  $.canvas.scaledRatio;
                $.canvas.panY =
                  (offset[1] * $.importer.params.flashRatio) /
                  $.canvas.scaledRatio;
              }

              $.canvas.items.pitch.init();
              // Set session Notes...
              if (!flashImport) {
                $("#canvas-notes").val(json.session_notes);
              } else {
                $("#canvas-notes").val(json.pitchText);
              }

              var $objects = [];
              var notPermitted = false;

              if (
                json.itemD &&
                (!Array.isArray(json.itemD) || json.itemD.length)
              ) {
                if (json.itemD.length) {
                  $.each(json.itemD, function (i, item) {
                    if (
                      $settings.template === "female" &&
                      item.name.lastIndexOf("gkc", 0) === 0
                    ) {
                      item.name = item.name.replace("gkc", "gkcf");
                    }

                    $objects.push($.importer.setItemD(item, flashImport));
                  });
                } else {
                  log("setItemD Object");

                  if (
                    $settings.template === "female" &&
                    json.itemD.name.lastIndexOf("gkc", 0) === 0
                  ) {
                    json.itemD.name = json.itemD.name.replace("gkc", "gkcf");
                  }

                  if (!notPermitted) {
                    $objects.push($.importer.setItemD(json.itemD, flashImport));
                  }
                }
              }

              if (
                json.item &&
                (!Array.isArray(json.item) || json.item.length)
              ) {
                if (json.item.length) {
                  log("setItem Array");
                  $.each(json.item, function (i, item) {
                    $objects.push(
                      $.importer.setItem(item, flashImport, canvas_id, i)
                    );
                  });
                } else {
                  log("setItem Object");
                  $objects.push(
                    $.importer.setItem(json.item, flashImport, canvas_id, i)
                  );
                }
              }

              if (
                json.player &&
                (!Array.isArray(json.player) || json.player.length)
              ) {
                if (json.player.length) {
                  log("setPlayer Array");

                  $.each(json.player, function (i, item) {
                    //$.importer.setPlayer(item,flashImport);

                    // is the player allowed...
                    if ($settings.template === "female" && item.pose <= 100) {
                      notPermitted = true;
                      return;
                    } else if (
                      ($settings.template === "male" ||
                        $settings.template === "futsal") &&
                      item.pose > 100
                    ) {
                      notPermitted = true;
                      return;
                    }

                    if ($settings.template === "female") {
                      item.is_female = true;
                      item.pose = parseInt(item.pose) - 100;
                    }

                    $objects.push($.importer.setPlayer(item, flashImport));
                  });
                } else {
                  log("setPlayer Object");

                  if (
                    $settings.template === "female" &&
                    json.player.pose <= 100
                  ) {
                    notPermitted = true;
                  } else if (
                    ($settings.template === "male" ||
                      $settings.template === "futsal") &&
                    json.player.pose > 100
                  ) {
                    notPermitted = true;
                  }

                  if (!notPermitted) {
                    if ($settings.template === "female") {
                      json.player.is_female = true;
                      json.player.pose = parseInt(json.player.pose) - 100;
                    }
                    $objects.push(
                      $.importer.setPlayer(json.player, flashImport)
                    );
                  }
                }
              }

              if (notPermitted) {
                $.dialog.alert({
                  title:
                    $lang[$settings["language"]]["unauthorised_items_title"],
                  description:
                    $lang[$settings["language"]][
                      "unauthorised_items_description"
                    ],
                  cancelText: $lang[$settings["language"]]["ok"],
                });
              }

              $.canvas.history.appendAll($objects);
              $.canvas.reset();
              $.canvas.items.set(this, "drag_items", "init_click");
            }
          });
          var total_slide = count_canvas - 1;

          var last_object = json_all_new["canvas_" + total_slide];
          $(".next-number").html(count_canvas - 1);
          $(".next-number").attr("next-count", count_canvas - 1);
          $(".prev-number").html(count_canvas - 1);
          $(".prev-number").attr("prev-count", count_canvas - 1);
          canvas_number = count_canvas;
          //var current_slide_no = parseInt($(".prev-number").html());
          var current_slide_no = parseInt($(".prev-number").attr("prev-count"));

          //var total_slide_no = parseInt($(".next-number").html());
          var total_slide_no = parseInt($(".next-number").attr("next-count"));
          try {
            localStorage.setItem("pitch_number", pitch_number_old);
          } catch (ex) {}

          pitch_number = pitch_number_old;
          if (
            pitch_number_old < total_slide_no &&
            total_slide_no == current_slide_no
          ) {
            if (pitch_number > 0) {
              $(".close-btn").show();
              $(".duplicate_slide").show();
            }

            $(".select-pitch").show();
          } else {
            $(".select-pitch").hide();
          }

          for (var i = 1; i <= total_slide; i++) {
            $(".footer-section-2").append(
              "<img class='image-slide-show' id='image-slide-show" +
                i +
                "' src='" +
                site_url +
                "components/com_sessioncreatorv1/assets/images/grid-film.png' pitch_number=" +
                i +
                ">"
            );
          }

          $(".pitces").parent("li").removeClass("active");
          $("#" + $.canvas.items.pitch.current)
            .parent("li")
            .addClass("active");
          var flashImport = false;
        } catch (e) {
          var json = $.xml2json(data.EncodeXMLEscapeChars());

          var flashImport = true;
        }
      },
      export: function () {
        if (pitch_number == 0) {
          return false;
        }
        $(".save_session_container").show();
      },
      getExportData: function () {
        var $currentObjects = $.extend(
          true,
          [],
          $.canvas.history.currentObjects()
        );
        var visible_canvas_id = $(".canvas:visible").attr("id");
        canvas_id_arr = visible_canvas_id.split("_");
        console.log("isAlwaysExecuted")
        if ($currentObjects.length) {
          $.each($currentObjects, function (i, item) {
            // convert to object...
            // calculate x_percent
            $currentObjects[i].x_start_percent = calculateXPercent(
              $currentObjects[i].startX
            );
            $currentObjects[i].y_start_percent = calculateYPercent(
              $currentObjects[i].startY
            );
            $currentObjects[i].x_percent = calculateXPercent(
              $currentObjects[i].endX
            );
            $currentObjects[i].y_percent = calculateYPercent(
              $currentObjects[i].endY
            );
            $currentObjects[i].x_center_percent = calculateXPercent(
              $currentObjects[i].centerX
            );
            $currentObjects[i].y_center_percent = calculateYPercent(
              $currentObjects[i].centerY
            );
            // console.log($currentObjects[i].x_percent + "$currentObjects[i].x_percent");
            // $currentObjects[i].x_percent = parseFloat(
            //   ($currentObjects[i].endX * 100) / $(".canvas:visible").width()
            // );
            // $currentObjects[i].y_percent = parseFloat(
            //   ($currentObjects[i].endY * 100) / $(".canvas:visible").height()
            // );
            $currentObjects[i] = $.extend({}, $currentObjects[i]);
            $currentObjects[i].text_tool_color =
              $currentObjects[i].cache.text_tool_color;
            delete $currentObjects[i].cache;
            delete $currentObjects[i].hitarea;
          });
        }
        // set practice information in history
        var practice_info = {};
        $(".practice_canvas_" + canvas_id_arr[1])
          .find(".practices_infomation")
          .each(function () {
            if ($(this).val()) {
              practice_info[$(this).attr("ref-name")] = $(this).val();
            }
          });

        obj_history[visible_canvas_id] = {
          pitch: $.canvas.items.pitch.current,
          pitch_colour: $.canvas.items.pitch.colour,
          zoomTracking: $.canvas.zoomTracking,
          panX: $.canvas.panX * $.canvas.scaledRatio,
          panY: $.canvas.panY * $.canvas.scaledRatio,
          item: $currentObjects,
          practice_infomation: practice_info,
          pitch_number: pitch_number,
        };

        return JSON.stringify(obj_history);
      },
      doExport: function (is_export) {
        $("#dialog-wrap-parent-export").remove();
        $(".save-session-header").show();
        var $jsonstring = $.importer.getExportData(),
          site_url = baseURL;
        // save session
        var exported_session_plan = 0;
        var canvas_image = "";
        if (is_export) {
          exported_session_plan = $("#selected_session_part").val();

          canvas_image_url = "";
          var image_uploaded_no = 0;

          var canvas_url = {};
          if (exported_session_plan == 1) {
            canvas_url["1"] = crop_canvas_img($("#canvas_1")[0]);
            ajax_call_to_save_images(canvas_url);
          } else if (exported_session_plan == 2) {
            canvas_url["1"] = crop_canvas_img($("#canvas_1")[0]);
            canvas_url["2"] = crop_canvas_img($("#canvas_2")[0]);
            console.log("canvas_url");
            console.log(canvas_url);
            ajax_call_to_save_images(canvas_url);
          } else if (exported_session_plan == 3) {
            canvas_url["1"] = crop_canvas_img($("#canvas_1")[0]);
            canvas_url["2"] = crop_canvas_img($("#canvas_2")[0]);
            ajax_call_to_save_images(canvas_url);
            var canvas_url = {};
            canvas_url["3"] = crop_canvas_img($("#canvas_3")[0]);
            ajax_call_to_save_images(canvas_url);
          } else if (exported_session_plan == 4) {
            canvas_url["1"] = crop_canvas_img($("#canvas_1")[0]);
            canvas_url["2"] = crop_canvas_img($("#canvas_2")[0]);
            ajax_call_to_save_images(canvas_url);
            var canvas_url = {};
            canvas_url["3"] = crop_canvas_img($("#canvas_3")[0]);
            canvas_url["4"] = crop_canvas_img($("#canvas_4")[0]);
            ajax_call_to_save_images(canvas_url);
          } else if (exported_session_plan == 5) {
            canvas_url["1"] = crop_canvas_img($("#canvas_1")[0]);
            canvas_url["2"] = crop_canvas_img($("#canvas_2")[0]);
            ajax_call_to_save_images(canvas_url);
            var canvas_url = {};
            canvas_url["3"] = crop_canvas_img($("#canvas_3")[0]);
            canvas_url["4"] = crop_canvas_img($("#canvas_4")[0]);
            ajax_call_to_save_images(canvas_url);
            var canvas_url = {};
            canvas_url["5"] = crop_canvas_img($("#canvas_5")[0]);
            ajax_call_to_save_images(canvas_url);
          } else if (exported_session_plan == 6) {
            canvas_url["1"] = crop_canvas_img($("#canvas_1")[0]);
            canvas_url["2"] = crop_canvas_img($("#canvas_2")[0]);
            ajax_call_to_save_images(canvas_url);
            var canvas_url = {};
            canvas_url["3"] = crop_canvas_img($("#canvas_3")[0]);
            canvas_url["4"] = crop_canvas_img($("#canvas_4")[0]);
            ajax_call_to_save_images(canvas_url);
            var canvas_url = {};
            canvas_url["5"] = crop_canvas_img($("#canvas_5")[0]);
            canvas_url["6"] = crop_canvas_img($("#canvas_6")[0]);
            ajax_call_to_save_images(canvas_url);
          }
          function ajax_call_to_save_images(canvas_url) {
            $.ajax({
              method: "POST",
              url:
                baseURL +
                "/index.php?option=com_sessioncreatorv1&task=sessioncreatorv1.saveCanvasImage&tmpl=component",
              data: {
                canvas_image: canvas_url,
                user_id: $("#user_id").val(),
                exported_session_plan: exported_session_plan,
              },
              dataType: "json",
              async: false,
              beforeSend: function () {
                $("body").append(
                  '<div class="modal-backdrop fade in"><i class="fa fa-spinner fa-spin"></i></div>'
                );
              },
              success: function (result) {
                if (result) {
                  image_uploaded_no++;
                }
              },
              complete: function () {
                $(".modal-backdrop").remove();
              },
            });
          }
        }

        save_canvas_session(exported_session_plan, is_export, canvas_image);
      },
      deleteSlide: function () {
        current_number = parseInt($(".prev-number").attr("prev-count"));
        total_number = parseInt($(".next-number").attr("next-count"));
        $(".footer-section-2")
          .find("#image-slide-show" + total_number)
          .remove();
        if (total_number > 1) {
          if (pitch_number < total_number && total_number == current_number) {
          } else {
            if (pitch_number > 1) {
              pitch_number = pitch_number - 1;
              try {
                localStorage.pitch_number = pitch_number;
              } catch (ex) {}
            }
            if (pitch_number_old != "undefined" && pitch_number_old > 1) {
              pitch_number_old = pitch_number_old - 1;
            }
          }

          if (current_number < total_number) {
            $(".canvas:visible").parent(".canvas-content").remove();
            obj_history["canvas_" + current_number] = null;
            delete obj_history["canvas_" + current_number];
            // $.canvas.history.doAutoSave();
            for (var i = current_number; i < total_number; i++) {
              var new_current_number = i + 1;
              canvas_state[i] = canvas_state[new_current_number];
              obj_history["canvas_" + i] =
                obj_history["canvas_" + new_current_number];

              $("#canvas_" + new_current_number).attr("ref-canvas", i);
              $("#canvas_" + new_current_number).attr("id", "canvas_" + i);
            }
            canvas_number = canvas_number - 1;

            $(".prev-number").html(current_number - 1);
            $(".prev-number").attr("prev-count", current_number - 1);
            $(".next-slide").trigger("click");
            $(".next-number").html(total_number - 1);
            $(".next-number").attr("next-count", total_number - 1);
            delete canvas_state[total_number];
            obj_history["canvas_" + total_number] = null;
            delete obj_history["canvas_" + total_number];
            $.canvas.history.doAutoSave();
            $("#canvas_" + current_number)
              .parent(".canvas-content")
              .show();
          } else {
            new_number = current_number - 1;
            $(".canvas:visible").parent(".canvas-content").remove();
            $(".prev-number").html(new_number);
            $(".prev-number").attr("prev-count", current_number - 1);
            $(".next-number").html(new_number);
            $(".next-number").attr("next-count", new_number);
            //$.canvas.reset();
            $.canvas = canvas_state[new_number];
            canvas_number = canvas_number - 1;
            $("#canvas_" + new_number)
              .parent(".canvas-content")
              .show();
            delete obj_history["canvas_" + current_number];
            $.canvas.history.doAutoSave();
          }

          $(".select-pitch").hide();
        } else {
          $.canvas.history.clearAutoSave();
          next_click = 1;
          setCanvas("canvas_1");
          $(".select-pitch").show();
        }
      },
    };
    $(function () {
      $.importer.init();
    });
  })(jQuery);
  (function ($) {
    $.print = function () {
      $.dialog.confirm({
        title: $lang[$settings["language"]]["print_title"],
        description: "",
        actionText: "Print",
        //actionAltText: $lang[$settings['language']]['print_alt_action'],
        cancelText: $lang[$settings["language"]]["cancel"],
        callback: function ($clickObj) {
          if ($($clickObj).hasClass("dialog-action")) {
            $("body").addClass("print_notes");
          } else {
            $("body").removeClass("print_notes");
          }
          $("#header-part").addClass("printable");
          $("#footer-part").addClass("printable");
          window.print();
          return false;
        },
      });
    };
  })(jQuery);
  (function ($) {
    $.getTextLines = function (text, maxWidth) {
      var lines = text.split("\n");
      (textLines = []),
        (canvas = $('<canvas width="10" height="10"></canvas>')),
        (canvasobject = canvas[0].getContext("2d"));

      canvasobject.font = 'normal 32px "Helvetica Neue", Helvetica, Arial';
      canvasobject.textAlign = "left";
      canvasobject.textBaseline = "top";

      for (var n = 0; n < lines.length; n++) {
        var metrics = canvasobject.measureText(lines[n]);
        if (metrics.width > maxWidth) {
          // split into words an split into lines...
          var words = lines[n].split(" "),
            currentLine = "";
          for (var i = 0; i < words.length; i++) {
            var newLine = currentLine + words[i] + " ";
            var metrics = canvasobject.measureText(newLine);
            if (metrics.width > maxWidth) {
              // push this line and create a new one!
              textLines.push(currentLine);
              currentLine = words[i] + " ";
            } else {
              currentLine = newLine;
            }
          }
          if (currentLine != "") {
            textLines.push(currentLine);
          }
        } else {
          textLines.push(lines[n]);
        }
      }
      return textLines;
    };
    $.wrapText = function (context, text, x, y, maxWidth, lineHeight) {
      var words = text.split(" ");
      var line = "";

      for (var n = 0; n < words.length; n++) {
        var testLine = line + words[n] + " ";
        var metrics = context.measureText(testLine);
        var testWidth = metrics.width;
        if (testWidth > maxWidth && n > 0) {
          context.fillText(line, x, y);
          line = words[n] + " ";
          y += lineHeight;
        } else {
          line = testLine;
        }
      }
      context.fillText(line, x, y);
      return linebreaks;
    };

    $.generateImage = function () {
      if (pitch_number == 0) {
        return false;
      }
      $.modal.show({
        title: $lang[$settings["language"]]["generate_title"],
        content:
          '<div id="image-download"></div><div class="image-creation-pop-bottom" style="text-align:center"><div><div class="input-inline"><label for="include_notes" class="inlabel">' +
          $lang[$settings["language"]]["generate_label"] +
          '</label><div class="checkbox-wrapper"><input id="include_notes" type="checkbox" name="include_notes" class="checkbox"></div></div></div><span>' +
          $lang[$settings["language"]]["generate_description"] +
          "</span></div>",
        cancelText: $lang[$settings["language"]]["cancel"],
        openCallback: function () {
          $.formInputs.init();
          $("#include_notes").on("change", function () {
            $.createImage();
          });
          $.createImage();
        },
        callback: function ($clickObj) {
          $.dialog.hide($clickObj, true);
        },
      });
    };
    $.createImage = function () {
      var height = $.canvas.size.height,
        width = $.canvas.size.width,
        dataURL = $(".canvas:visible")[0].toDataURL(),
        img = new Image();

      if ($("#include_notes").is(":checked") && $("#canvas-notes").val()) {
        var lines = $.getTextLines($("#canvas-notes").val(), width - 80),
          textHeight = lines.length * 40 + 80,
          $canvas = $(
            '<canvas width="' +
              width +
              '" height="' +
              (height + textHeight) +
              '">Your browser does not support HTML5 Canvas.</canvas>'
          ),
          $canvasobject = $canvas[0].getContext("2d"),
          $textcanvas = $(
            '<canvas width="' +
              width +
              '" height="' +
              textHeight +
              '">Your browser does not support HTML5 Canvas.</canvas>'
          ),
          $textcanvasobject = $textcanvas[0].getContext("2d");

        $textcanvasobject.beginPath();
        $textcanvasobject.rect(0, 0, width, height + textHeight);
        $textcanvasobject.fillStyle = "white";
        $textcanvasobject.fill();

        img.src = dataURL;
        img.onload = function () {
          // draw text to canvas...
          $textcanvasobject.font =
            'normal 32px "Helvetica Neue", Helvetica, Arial';
          $textcanvasobject.fillStyle = "#000000";
          $textcanvasobject.textAlign = "left";
          $textcanvasobject.textBaseline = "top";

          // sort text in to lines that fit the canvas...
          $.each(lines, function (i, line) {
            var lineheight = i * 40,
              offset = 40;
            //$.wrapText($textcanvasobject, line, 0, lineheight, width, 40);
            $textcanvasobject.fillText(
              line,
              40,
              lineheight + offset,
              width - 80
            );
          });

          var textdataURL = $textcanvas[0].toDataURL(),
            textimg = new Image();

          textimg.src = textdataURL;
          textimg.onload = function () {
            $canvasobject.drawImage(
              img,
              0,
              0,
              $.canvas.size.width,
              $.canvas.size.height
            );
            $canvasobject.drawImage(
              textimg,
              0,
              height,
              $.canvas.size.width,
              textHeight
            );

            dataURL = $canvas[0].toDataURL();
            img = new Image();
            img.src = dataURL;
            img.onload = function () {
              $("#image-download").html(this);
            };
          };
        };
      } else {
        img.src = dataURL;
        img.onload = function () {
          $("#image-download").html(this);
        };
      }
    };
  })(jQuery);
  (function ($) {
    $.scrollable = {
      init: function () {
        if (!$(".scrollable").length) {
          return;
        }
        $(".scrollable").each(function () {
          var scrollbar = new Swiper(".scrollable", {
            wrapperClass: "scrollable-inner",
            slideClass: "scrollable-content",
            scrollbar: ".scrollbar",
            direction: "vertical",
            slidesPerView: "auto",
            mousewheelControl: true,
            freeMode: true,
          });
        });
      },
    };
    $(function () {
      $.scrollable.init();
    });
  })(jQuery);
  (function ($) {
    $.players = {
      init: function () {
        // $(window).on("resize resizeend", $.players.height);
        //$(window).resize();

        $("html")
          .off()
          .on("mousemove touchmove", function (e) {
            $.players.hideMore(e);
          });

        $("#male-players-btn")
          .off()
          .on("click", function (e) {
            if (!$(this).hasClass("active")) {
              $("#female-players-btn").removeClass("active");
              $(this).addClass("active");
              $(
                "#female-players-navigation,#female-playersextra-navigation,#female-goaliesextra-navigation"
              ).hide();
              $(
                "#male-players-navigation,#male-playersextra-navigation,#male-goaliesextra-navigation"
              ).show();
              $(window).resize();
              $.players.closeExtras();
            }
            return;
          });
        $("#female-players-btn")
          .off()
          .on("click", function (e) {
            if (!$(this).hasClass("active")) {
              $("#male-players-btn").removeClass("active");
              $(this).addClass("active");
              $(
                "#female-players-navigation,#female-playersextra-navigation,#female-goaliesextra-navigation"
              ).show();
              $(
                "#male-players-navigation,#male-playersextra-navigation,#male-goaliesextra-navigation"
              ).hide();
              $(window).resize();
              $.players.closeExtras();
            }
            return;
          });
        if ($("#body").hasClass("combined")) {
          $(
            "#female-players-navigation,#female-playersextra-navigation,#female-goaliesextra-navigation"
          ).hide();
          $(
            "#male-players-navigation,#male-playersextra-navigation,#male-goaliesextra-navigation"
          ).show();
        }
      },
      closeExtras: function () {
        $.players.isOpen = false;
        $(".playersextra-navigation").hide();
        $(".goaliesextra-navigation").hide();
        $(".gks").show();
      },
      hideMore: function (e) {
        if (
          e.type == "touchstart" ||
          e.type == "touchmove" ||
          e.type == "touchend" ||
          e.type == "touchcancel"
        ) {
          var touch =
            e.originalEvent.touches[0] || e.originalEvent.changedTouches[0];
          e.pageX = touch.pageX;
          e.pageY = touch.pageY;
        } else if (
          e.type == "mousedown" ||
          e.type == "mouseup" ||
          e.type == "mousemove" ||
          e.type == "mouseover" ||
          e.type == "mouseout" ||
          e.type == "mouseenter" ||
          e.type == "mouseleave"
        ) {
        }
        if (e.pageX > $(".players-navigation").width()) {
          $.players.closeExtras();
          return;
        }

        // we're over the players nav - check if we should show a menu...
        var height = $("#player-guide").height();
        if ($.players.isOpen) {
          // check if we should close the goalies nav now...
          if ($.players.isOpen === "goalies") {
            if (
              e.pageY <
              $("#kit-navigation").height() +
                $("#kit-navigation").offset().top +
                height * 11
            ) {
              $.players.closeExtras();
            }
          }
        } else {
          // check if we should open...
          if (
            (e.target === $("#male-reveal-players")[0] ||
              e.target === $("#female-reveal-players")[0]) &&
            e.pageY <
              $("#kit-navigation").height() +
                $("#kit-navigation").offset().top +
                height * 12
          ) {
            $.players.isOpen = "players";
            $(".gks").hide();
            $(".goaliesextra-navigation").hide();
            $(".playersextra-navigation").hide();
            if ($("#male-players-btn").hasClass("active")) {
              $("#male-playersextra-navigation").show();
            } else {
              $("#female-playersextra-navigation").show();
            }
          }

          //                            else if(e.pageY > ($('#kit-navigation').height() + $('#kit-navigation').offset().top + (height * 12) )) {
          //		        	$.players.isOpen = 'goalies';
          //					$('.gks').hide();
          //					$('.playersextra-navigation').hide();
          //					$('.goaliesextra-navigation').hide();
          //					if($('#male-players-btn').hasClass('active')) {
          //						$('#male-goaliesextra-navigation').show();
          //					} else {
          //						$('#female-goaliesextra-navigation').show();
          //					}
          //				}
        }
      },
      height: function (e) {
        var height = $("#player-guide").height(),
          padding = parseFloat($("body").css("font-size").replace("px", ""));

        $(".players-navigation li, .playersextra-navigation li").css({
          height: height + "px",
        });

        $(".playersextra-navigation").css({
          height: height * 6 + padding + "px",
        });

        //$('.goaliesextra-navigation').css({'top':( $('#kit-navigation').height() + $('#kit-navigation').offset().top ) + (height * 11) + 'px','height':(height * 1) + (padding)+'px'});

        $(".reveal-players").css({ top: height * 10 + "px" });
        $(".reveal-goalies").css({ top: height * 11 + "px" });

        $(".gks").css({
          top: height * 11 + padding + height * 0.1 + "px",
          height: height * 0.8 + "px",
        });
      },
    };
    $(function () {
      $.players.init();
    });
  })(jQuery);
  (function ($) {
    $.kitColours = {
      template: $("#kit-colours-jstemplate").html(),
      colourTemplate: $("#kit-colours-colours-jstemplate").html(),
      init: function () {
        $(document).on("click", ".kit-colours", function () {
          $.kitColours.open($(this));
          $(document).on("mousedown touchstart", $.kitColours.close);
          $(window).on("resize resizeend", $.kitColours.close);
        });

        // set colours based on settings...
        $.kitColours.defaults = $settings.kit_colours;
        $.kitColours.setColours(".team_1", $.kitColours.defaults.team_1, true);
        $.kitColours.setColours(".team_2", $.kitColours.defaults.team_2, true);

        // override colours based on local storage...
        $.local.DB.getItem("kit_colours", function (err, value) {
          if (!err && value) {
            $.kitColours.defaults = value;
            $.kitColours.setColours(
              ".team_1",
              $.kitColours.defaults.team_1,
              true
            );
            $.kitColours.setColours(
              ".team_2",
              $.kitColours.defaults.team_2,
              true
            );
          }
        });
      },
      open: function (team) {
        if ($.kitColours.current && $.kitColours.current[0] === team[0]) {
          $.kitColours.remove();
          return;
        }

        $.kitColours.current = team;

        $("#kit-colours").remove();

        team.parent().addClass("active");

        var $offset = team.offset(),
          $height = team.outerHeight();
        $("body").append($.kitColours.template);
        // update lang
        $.language.switch($settings["language"]);

        // update plyer
        if ($("#body").hasClass("combined")) {
          if ($("#male-players-btn").hasClass("active")) {
            // hide female player
            $(".kit-preview-female").hide();
          } else {
            $(".kit-preview-male").hide();
          }
        }

        $("#kit-colours .kit-colour").each(function () {
          $(this).css({ "background-color": $(this).data("colour") });
        });

        $("#kit-colours")
          .css({ top: $offset.top + $height, left: $offset.left })
          .hide()
          .fadeIn();
        $.kitColours.currentPreview = $.extend(
          true,
          {},
          $.kitColours.defaults["team_" + team.data("team")]
        );
        $.kitColours.setColours(
          "#kit-colours .preview",
          $.kitColours.currentPreview,
          true
        );

        //$.kitColours.skinPicker();

        $("#kit-colours .kit-style").on("click", function () {
          var preview = $.extend(true, {}, $.kitColours.currentPreview),
            $styles = ["mono", "vertical", "horizontal"];

          if ($(this).hasClass("mono")) {
            $(this).removeClass("mono").addClass("vertical");
            preview[$(this).data("item")].type = "vertical";
          } else if ($(this).hasClass("vertical")) {
            $(this).removeClass("vertical").addClass("horizontal");
            preview[$(this).data("item")].type = "horizontal";
          } else if ($(this).hasClass("horizontal")) {
            $(this).removeClass("horizontal").addClass("mono");
            preview[$(this).data("item")].type = "mono";
          }
          $.kitColours.setColours("#kit-colours .preview", preview);
        });
        $("#kit-colours .kit-styles .skin-colours .kit-colour").on(
          "click",
          function () {
            $.kitColours.currentPreview.skin = $(this).data("colour");
            $.kitColours.setColours(
              "#kit-colours .preview",
              $.kitColours.currentPreview,
              true
            );
          }
        );
        $("#kit-colours .kit-base-colour,#kit-colours .kit-alt-colour").on(
          "click",
          function () {
            $.kitColours.showColours($(this));
          }
        );
      },
      skinPicker: function () {
        var ctx = $("#skin-colour-canvas")[0].getContext("2d");
        var grd = ctx.createLinearGradient(0, 0, 200, 0);
        grd.addColorStop(0, "#F8F7A4");
        grd.addColorStop(0.5, "#D7875F");
        grd.addColorStop(1, "#271800");
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, 200, 30);

        $("#skin-colour-canvas").on("mousedown touchstart", function (e) {
          e.stopPropagation();
          e.preventDefault();
          if (
            e.type == "touchstart" ||
            e.type == "touchmove" ||
            e.type == "touchend" ||
            e.type == "touchcancel"
          ) {
            var touch =
              e.originalEvent.touches[0] || e.originalEvent.changedTouches[0];
            e.pageX = touch.pageX;
            e.pageY = touch.pageY;
          } else if (
            e.type == "mousedown" ||
            e.type == "mouseup" ||
            e.type == "mousemove" ||
            e.type == "mouseover" ||
            e.type == "mouseout" ||
            e.type == "mouseenter" ||
            e.type == "mouseleave"
          ) {
          }
          var canvasOffset = $("#skin-colour-canvas").offset(),
            ratio = 200 / $("#skin-colour-canvas").width(),
            mouseX = Math.round(parseInt(e.pageX - canvasOffset.left) * ratio),
            point = ctx.getImageData(
              mouseX,
              $("#skin-colour-canvas").height() / 2,
              1,
              1
            ).data,
            hex =
              "#" +
              (
                "000000" + $.kitColours.rgbToHex(point[0], point[1], point[2])
              ).slice(-6);

          $.kitColours.currentPreview.skin = hex;
          $.kitColours.setColours(
            "#kit-colours .preview",
            $.kitColours.currentPreview,
            true
          );
        });
      },
      rgbToHex: function (r, g, b) {
        if (r > 255 || g > 255 || b > 255) {
          throw "Invalid color component";
        }
        return ((r << 16) | (g << 8) | b).toString(16);
      },
      showColours: function (btn) {
        if (
          $.kitColours.currentColour &&
          $.kitColours.currentColour[0] === btn[0]
        ) {
          return;
        }

        $.kitColours.currentColour = btn;
        $("#kit-colours").append($.kitColours.colourTemplate);
        var $offset = btn.position(),
          $height = btn.outerHeight();

        $("#kit-colours-colours .kit-colour").each(function () {
          $(this).css({ "background-color": $(this).data("colour") });
        });

        var val = "#000000";
        if ($.kitColours.currentColour) {
          if ($.kitColours.currentColour.hasClass("kit-base-colour")) {
            val =
              $.kitColours.currentPreview[
                $.kitColours.currentColour.data("item")
              ].base_colour;
          } else {
            val =
              $.kitColours.currentPreview[
                $.kitColours.currentColour.data("item")
              ].stripe_colour;
          }
        }
        $("#kit-colours-input").val(val);

        $("#kit-colours-colours .kit-colour")
          .on("mouseover", function () {
            $("#kit-colours-input").val($(this).data("colour"));
          })
          .on("mouseout", function (e) {
            var val = "#000000";
            if ($.kitColours.currentColour) {
              if ($.kitColours.currentColour.hasClass("kit-base-colour")) {
                val =
                  $.kitColours.currentPreview[
                    $.kitColours.currentColour.data("item")
                  ].base_colour;
              } else {
                val =
                  $.kitColours.currentPreview[
                    $.kitColours.currentColour.data("item")
                  ].stripe_colour;
              }
            }
            $("#kit-colours-input").val(val);
          })
          .on("click", function () {
            if ($.kitColours.currentColour.hasClass("kit-base-colour")) {
              $.kitColours.currentPreview[
                $.kitColours.currentColour.data("item")
              ].base_colour = $(this).data("colour");
            } else {
              $.kitColours.currentPreview[
                $.kitColours.currentColour.data("item")
              ].stripe_colour = $(this).data("colour");
            }
            $("#kit-colours-input").val($(this).data("colour"));
            $("#kit-colours-colours").remove();
            $.kitColours.currentColour = null;
            $.kitColours.setColours(
              "#kit-colours .preview",
              $.kitColours.currentPreview,
              true
            );
          });

        $("#kit-colours-colours")
          .css({ top: $offset.top + $height, left: $offset.left })
          .hide()
          .fadeIn();
      },
      applyStyles: function () {
        var team = $.kitColours.current.data("team");
        $.kitColours.defaults["team_" + team] = $.kitColours.currentPreview;
        $.kitColours.setColours(".team_" + team, $.kitColours.currentPreview);
        $.kitColours.remove();

        // Save to localDB...
        $.local.DB.setItem("kit_colours", $.kitColours.defaults);
      },
      setColours: function (target, values, updateBtns) {
        if (updateBtns) {
          if (values.shirt.type == "vertical") {
            $("#kit-colours .kit-shirt .kit-style")
              .removeClass("mono")
              .addClass("vertical");
          } else if (values.shirt.type == "horizontal") {
            $("#kit-colours .kit-shirt .kit-style")
              .removeClass("mono")
              .addClass("horizontal");
          }
          if (values.shorts.type == "vertical") {
            $("#kit-colours .kit-shorts .kit-style")
              .removeClass("mono")
              .addClass("vertical");
          } else if (values.shorts.type == "horizontal") {
            $("#kit-colours .kit-shorts .kit-style")
              .removeClass("mono")
              .addClass("horizontal");
          }
          if (values.socks.type == "vertical") {
            $("#kit-colours .kit-socks .kit-style")
              .removeClass("mono")
              .addClass("vertical");
          } else if (values.socks.type == "horizontal") {
            $("#kit-colours .kit-socks .kit-style")
              .removeClass("mono")
              .addClass("horizontal");
          }

          $("#kit-colours .kit-shirt .kit-base-colour").css({
            "background-color": values.shirt.base_colour,
          });
          $("#kit-colours .kit-shirt .kit-alt-colour").css({
            "background-color": values.shirt.stripe_colour,
          });
          $("#kit-colours .kit-shorts .kit-base-colour").css({
            "background-color": values.shorts.base_colour,
          });
          $("#kit-colours .kit-shorts .kit-alt-colour").css({
            "background-color": values.shorts.stripe_colour,
          });
          $("#kit-colours .kit-socks .kit-base-colour").css({
            "background-color": values.socks.base_colour,
          });
          $("#kit-colours .kit-socks .kit-alt-colour").css({
            "background-color": values.socks.stripe_colour,
          });
          $("#kit-colours .skin-colour").css({
            "background-color": values.skin,
          });
        }

        // Shirt...
        $(
          target +
            " svg g#shirt path," +
            target +
            " svg g#shirt circle," +
            target +
            " svg g#shirt polygon"
        ).css({ fill: values.shirt.base_colour });
        $(
          target +
            " svg g#shirt_vert path," +
            target +
            " svg g#shirt_vert polygon," +
            target +
            " svg g#shirt_horz path," +
            target +
            " svg g#shirt_horz polygon"
        ).css({ fill: values.shirt.stripe_colour });
        if (values.shirt.type == "mono") {
          $(target).find("#shirt_horz").hide();
          $(target).find("#shirt_vert").hide();
        } else if (values.shirt.type == "vertical") {
          $(target).find("#shirt_horz").hide();
          $(target).find("#shirt_vert").show();
        } else if (values.shirt.type == "horizontal") {
          $(target).find("#shirt_horz").show();
          $(target).find("#shirt_vert").hide();
        }

        // Shorts...
        $(target + " svg g#shorts path").css({
          fill: values.shorts.base_colour,
        });
        $(
          target +
            " svg g#shorts_vert path, " +
            target +
            " svg g#shorts_horz path"
        ).css({ fill: values.shorts.stripe_colour });
        if (values.shorts.type == "mono") {
          $(target).find("#shorts_horz").hide();
          $(target).find("#shorts_vert").hide();
        } else if (values.shorts.type == "vertical") {
          $(target).find("#shorts_horz").hide();
          $(target).find("#shorts_vert").show();
        } else if (values.shorts.type == "horizontal") {
          $(target).find("#shorts_horz").show();
          $(target).find("#shorts_vert").hide();
        }

        // Socks...
        $(target + " svg g#socks path").css({ fill: values.socks.base_colour });
        $(
          target + " svg g#socks_vert path," + target + " svg g#socks_horz path"
        ).css({ fill: values.socks.stripe_colour });
        if (values.socks.type == "mono") {
          $(target).find("#socks_horz").hide();
          $(target).find("#socks_vert").hide();
        } else if (values.socks.type == "vertical") {
          $(target).find("#socks_horz").hide();
          $(target).find("#socks_vert").show();
        } else if (values.socks.type == "horizontal") {
          $(target).find("#socks_horz").show();
          $(target).find("#socks_vert").hide();
        }

        $(target + " svg g#skin path").css({ fill: values.skin });

        $.kitColours.currentPreview = values;
      },
      close: function (e) {
        if (
          !$(e.target).is("#kit-colours") &&
          $.kitColours.current &&
          $.kitColours.current[0] !== $(e.target)[0] &&
          !$(e.target).parents("#kit-colours").length
        ) {
          $.kitColours.remove();
        }
        if (
          !$(e.target).is("#kit-colours-colours") &&
          $.kitColours.currentColour &&
          $.kitColours.currentColour[0] !== $(e.target)[0] &&
          !$(e.target).parents("#kit-colours-colours").length
        ) {
          $.kitColours.currentColour = null;
          $("#kit-colours-colours").remove();
        }
      },
      remove: function () {
        $.kitColours.current = null;
        $.kitColours.currentColour = null;
        $(".kit-colours").parent().removeClass("active");
        $("#kit-colours").remove();
        $("#kit-colours-colours").remove();
        $(document).off("mousedown touchstart", $.kitColours.close);
        $(window).off("resize resizeend", $.kitColours.close);
      },
    };

    $(function () {
      $.kitColours.init();
    });
  })(jQuery);

  (function ($) {
    $.infodialog = function () {
      $.modal.show({
        title: $lang[$settings["language"]]["info_title"],
        content: $lang[$settings["language"]]["info_text"],
        cancelText: $lang[$settings["language"]]["cancel"],
      });
    };
    $.helpdialog = function () {
      $.modal.show({
        title: $lang[$settings["language"]]["help_title"],
        content: $lang[$settings["language"]]["help_text"],
        cancelText: $lang[$settings["language"]]["cancel"],
      });
    };
  })(jQuery);

  (function ($) {
    // dribble opposition
    $.canvas.items.dribble_opposition = $.extend(
      true,
      {},
      $.canvas.items.dribble
    );
    $.canvas.items.dribble_opposition.defaults = {
      strokeStyle: "#E70E0E",
    };
    //dribble opposition line with circle on head
    $.canvas.items.dribbleheadcircle_opposition = $.extend(
      true,
      {},
      $.canvas.items.dribblecircle
    );
    $.canvas.items.dribbleheadcircle_opposition.defaults = {
      strokeStyle: "#E70E0E",
    };

    // pass/shot opposition
    $.canvas.items.pass_opposition = $.extend(true, {}, $.canvas.items.pass);
    $.canvas.items.pass_opposition.defaults = {
      strokeStyle: "#E70E0E",
    };

    //Dark straight line without arrow
    $.canvas.items.darkline_opposition = $.extend(
      true,
      {},
      $.canvas.items.darkline
    );
    $.canvas.items.darkline_opposition.defaults = {
      strokeStyle: "#E70E0E",
    };

    //movement line opposition circle on head
    $.canvas.items.movementlineheaddot_opposition = $.extend(
      true,
      {},
      $.canvas.items.dot
    );
    $.canvas.items.movementlineheaddot_opposition.defaults = {
      strokeStyle: $(".color_light_blue").css("backgroundColor"),
    };

    // pen opposition
    $.canvas.items.pen_opposition = $.extend(true, {}, $.canvas.items.pen);
    $.canvas.items.pen_opposition.defaults = {
      strokeStyle: "#E70E0E",
    };

    // bendpass opposition
    $.canvas.items.bendpass_opposition = $.extend(
      true,
      {},
      $.canvas.items.base
    );
    $.canvas.items.bendpass_opposition.defaults = {
      strokeStyle: "#E70E0E",
    };

    $.canvas.items.bendpass_opposition.onMove = function (e) {
      e.stopPropagation();
      e.preventDefault();

      $(".canvas:visible").removeClass("move");
      if (this.isCollision(e)) {
        return;
      }

      if (!$.canvas.items.current.isDown) {
        return;
      }

      var mousePosition = $.canvas.getOffset(e);

      $.canvas.items.current.endX = mousePosition.x;
      $.canvas.items.current.endY = mousePosition.y;

      $.canvas.items.current.centerX = $.canvas.items.current.startX;
      $.canvas.items.current.centerY = mousePosition.y;

      $.canvas.reset();
    };
    $.canvas.items.bendpass_opposition.drawHitArea = function ($item) {
      $shape = $.extend(true, {}, $item);
      var $width = $shape.endX - $shape.startX,
        $height = $shape.endY - $shape.startY;

      $shape.startX = 0;
      $shape.endX = $width;
      $shape.startY = 0;
      $shape.endY = $height;

      //flipped horz...
      if ($width < 0) {
        $width = $shape.startX - $shape.endX;
        $shape.startX = $width;
        $shape.endX = 0;
      }
      //flipped vert...
      if ($height < 0) {
        $height = $shape.startY - $shape.endY;
        $shape.startY = $height;
        $shape.endY = 0;
      }

      $shape.centerX = $shape.startX;
      $shape.centerY = $shape.endY;

      var $tooSmall = false;
      if (
        $height < this.hitAreaDefaults.lineWidth ||
        $width < this.hitAreaDefaults.lineWidth
      ) {
        $tooSmall = true;
        $width =
          $width < this.hitAreaDefaults.lineWidth
            ? this.hitAreaDefaults.lineWidth
            : $width;
        $height =
          $height < this.hitAreaDefaults.lineWidth
            ? this.hitAreaDefaults.lineWidth
            : $height;
      }

      var $canvas = $(
        '<canvas width="' +
          $width +
          '" height="' +
          $height +
          '">Your browser does not support HTML5 Canvas.</canvas>'
      );

      $.canvas.object = $canvas[0].getContext("2d");

      if ($tooSmall) {
        // just create a rectangle of color...
        $.canvas.object.fillStyle = "#000";
        $.canvas.object.fillRect(0, 0, $width, $height);
      } else {
        this.setDefaults(true);
        this._drawshape($shape);
        console.log("37?");
      }

      $.canvas.object = $(".canvas:visible")[0].getContext("2d");

      // for now lets append it....
      // $('#canvas-wrapper').append($canvas);

      return $canvas;
    };
    $.canvas.items.bendpass_opposition._drawshape = function ($item) {
      console.log("38?");
      $.canvas.object.beginPath();
      $.canvas.object.moveTo($item.startX, $item.startY);
      $.canvas.object.quadraticCurveTo(
        $item.centerX,
        $item.centerY,
        $item.endX,
        $item.endY
      );
      $.canvas.object.lineWidth = 2;
      if ($item.lines_color) {
        $.canvas.object.strokeStyle = $item.lines_color;
      }
      $.canvas.object.stroke();
      $.canvas.object.closePath();

      $.canvas.object.beginPath();
      // draw offset line, within bounds of drag area...
      if ($item.startX > $item.endX) {
        $.canvas.object.moveTo($item.startX - 10, $item.startY);
        $.canvas.object.quadraticCurveTo(
          $item.centerX - 5,
          $item.centerY,
          $item.endX,
          $item.endY
        );
      } else {
        $.canvas.object.moveTo($item.startX + 10, $item.startY);
        $.canvas.object.quadraticCurveTo(
          $item.centerX + 5,
          $item.centerY,
          $item.endX,
          $item.endY
        );
      }
      $.canvas.object.lineWidth = 2;
      $.canvas.object.stroke();
      $.canvas.object.closePath();

      // Add Arrow...
      if ($item.endX === $item.centerX && $item.endY === $item.centerY) {
        $.canvas.items.applyArrow(
          $item.startX,
          $item.startY,
          $item.endX,
          $item.endY
        );
      } else {
        $.canvas.items.applyArrow(
          $item.centerX,
          $item.centerY,
          $item.endX,
          $item.endY
        );
      }
    };

    // basicline opposition
    $.canvas.items.basicline_opposition = $.extend(
      true,
      {},
      $.canvas.items.basicline
    );
    $.canvas.items.basicline_opposition.defaults = {
      strokeStyle: "#E70E0E",
    };

    // circle opposition
    $.canvas.items.circle_opposition = $.extend(
      true,
      {},
      $.canvas.items.circle
    );
    $.canvas.items.circle_opposition.defaults = {
      strokeStyle: "#E70E0E",
      fillStyle: "rgba(0,0,0,0.3)",
    };

    // movementline opposition
    $.canvas.items.movementline_opposition = $.extend(
      true,
      {},
      $.canvas.items.movementline
    );
    $.canvas.items.movementline_opposition.defaults = {
      strokeStyle: "#E70E0E",
    };

    // Dotted straight line without head
    $.canvas.items.dottedstraightline_opposition = $.extend(
      true,
      {},
      $.canvas.items.dottedstraightline
    );
    $.canvas.items.dottedstraightline_opposition.defaults = {
      strokeStyle: "#E70E0E",
    };

    // 4th line movementline opposition dotted with a circle on head
    $.canvas.items.movementlinedotted_opposition = $.extend(
      true,
      {},
      $.canvas.items.movementlineheadcircle
    );
    $.canvas.items.movementlinedotted_opposition.defaults = {
      strokeStyle: "#E70E0E",
    };

    // arc opposition
    $.canvas.items.arc_opposition = $.extend(true, {}, $.canvas.items.arc);
    $.canvas.items.arc_opposition.defaults = {
      strokeStyle: "#E70E0E",
    };

    // curledpass opposition
    $.canvas.items.curledpass_opposition = $.extend(
      true,
      {},
      $.canvas.items.base
    );
    $.canvas.items.curledpass_opposition.defaults = {
      strokeStyle: "#E70E0E",
    };

    $.canvas.items.curledpass_opposition.onMove = function (e) {
      e.stopPropagation();
      e.preventDefault();

      $(".canvas:visible").removeClass("move");
      if (this.isCollision(e)) {
        return;
      }

      if (!$.canvas.items.current.isDown) {
        return;
      }

      var mousePosition = $.canvas.getOffset(e);

      $.canvas.items.current.endX = mousePosition.x;
      $.canvas.items.current.endY = mousePosition.y;

      $.canvas.items.current.centerX = mousePosition.x;
      $.canvas.items.current.centerY = $.canvas.items.current.startY;

      $.canvas.reset();
    };
    $.canvas.items.curledpass_opposition.drawHitArea = function ($item) {
      $shape = $.extend(true, {}, $item);
      var $width = $shape.endX - $shape.startX,
        $height = $shape.endY - $shape.startY;

      $shape.startX = 0;
      $shape.endX = $width;
      $shape.startY = 0;
      $shape.endY = $height;

      //flipped horz...
      if ($width < 0) {
        $width = $shape.startX - $shape.endX;
        $shape.startX = $width;
        $shape.endX = 0;
      }
      //flipped vert...
      if ($height < 0) {
        $height = $shape.startY - $shape.endY;
        $shape.startY = $height;
        $shape.endY = 0;
      }

      $shape.centerX = $shape.endX;
      $shape.centerY = $shape.startY;

      var $tooSmall = false;
      if (
        $height < this.hitAreaDefaults.lineWidth ||
        $width < this.hitAreaDefaults.lineWidth
      ) {
        $tooSmall = true;
        $width =
          $width < this.hitAreaDefaults.lineWidth
            ? this.hitAreaDefaults.lineWidth
            : $width;
        $height =
          $height < this.hitAreaDefaults.lineWidth
            ? this.hitAreaDefaults.lineWidth
            : $height;
      }

      var $canvas = $(
        '<canvas width="' +
          $width +
          '" height="' +
          $height +
          '">Your browser does not support HTML5 Canvas.</canvas>'
      );

      $.canvas.object = $canvas[0].getContext("2d");

      if ($tooSmall) {
        // just create a rectangle of color...
        $.canvas.object.fillStyle = "#000";
        $.canvas.object.fillRect(0, 0, $width, $height);
      } else {
        this.setDefaults(true);
        this._drawshape($shape);
        console.log("39?");
      }

      $.canvas.object = $(".canvas:visible")[0].getContext("2d");

      // for now lets append it....
      // $('#canvas-wrapper').append($canvas);

      return $canvas;
    };
    $.canvas.items.curledpass_opposition._drawshape = function ($item) {
      console.log("40?");
      var endX = calculateRevX($item.x_percent) || $item.endX;
      var endY = calculateRevY($item.y_percent) || $item.endY;
      var startX = calculateRevX($item.x_start_percent) || $item.startX;
      var startY = calculateRevY($item.y_start_percent) || $item.startY;
      var centerX = calculateRevX($item.x_center_percent) || $item.centerX;
      var centerY = calculateRevY($item.y_center_percent) || $item.centerY;
      $.canvas.object.beginPath();
      $.canvas.object.moveTo(startX, startY);
      $.canvas.object.quadraticCurveTo(
        centerX,
        centerY,
        endX,
        endY
      );
      $.canvas.object.lineWidth = 2;
      if ($item.lines_color) {
        $.canvas.object.strokeStyle = $item.lines_color;
      }
      $.canvas.object.stroke();
      $.canvas.object.closePath();

      $.canvas.object.beginPath();
      // draw offset line, within bounds of drag area...
      /*if($item.startY > $item.endY) {
		    $.canvas.object.moveTo($item.startX, $item.startY-10);
			$.canvas.object.quadraticCurveTo($item.centerX, $item.centerY-5, $item.endX, $item.endY);
	    } else {
		    $.canvas.object.moveTo($item.startX, $item.startY+10);
			$.canvas.object.quadraticCurveTo($item.centerX, $item.centerY+5, $item.endX, $item.endY);
	    }*/
      $.canvas.object.lineWidth = 2;
      $.canvas.object.stroke();
      $.canvas.object.closePath();

      // Add Arrow...
      if ($item.endX === $item.centerX && $item.endY === $item.centerY) {
        $.canvas.items.applyArrow(
          startX,
          startY,
          endX,
          endY
        );
      } else {
        $.canvas.items.applyArrow(
          centerX,
          centerY,
          endX,
          endY
        );
      }
    };

    // curved line without arrow on head
    $.canvas.items.curvedline_opposition = $.extend(
      true,
      {},
      $.canvas.items.base
    );
    $.canvas.items.curvedline_opposition.defaults = {
      strokeStyle: "#E70E0E",
    };

    $.canvas.items.curvedline_opposition.onMove = function (e) {
      e.stopPropagation();
      e.preventDefault();

      $(".canvas:visible").removeClass("move");
      if (this.isCollision(e)) {
        return;
      }

      if (!$.canvas.items.current.isDown) {
        return;
      }

      var mousePosition = $.canvas.getOffset(e);

      $.canvas.items.current.endX = mousePosition.x;
      $.canvas.items.current.endY = mousePosition.y;

      $.canvas.items.current.centerX = mousePosition.x;
      $.canvas.items.current.centerY = $.canvas.items.current.startY;

      $.canvas.reset();
    };
    $.canvas.items.curvedline_opposition.drawHitArea = function ($item) {
      $shape = $.extend(true, {}, $item);
      var $width = $shape.endX - $shape.startX,
        $height = $shape.endY - $shape.startY;

      $shape.startX = 0;
      $shape.endX = $width;
      $shape.startY = 0;
      $shape.endY = $height;

      //flipped horz...
      if ($width < 0) {
        $width = $shape.startX - $shape.endX;
        $shape.startX = $width;
        $shape.endX = 0;
      }
      //flipped vert...
      if ($height < 0) {
        $height = $shape.startY - $shape.endY;
        $shape.startY = $height;
        $shape.endY = 0;
      }

      $shape.centerX = $shape.endX;
      $shape.centerY = $shape.startY;

      var $tooSmall = false;
      if (
        $height < this.hitAreaDefaults.lineWidth ||
        $width < this.hitAreaDefaults.lineWidth
      ) {
        $tooSmall = true;
        $width =
          $width < this.hitAreaDefaults.lineWidth
            ? this.hitAreaDefaults.lineWidth
            : $width;
        $height =
          $height < this.hitAreaDefaults.lineWidth
            ? this.hitAreaDefaults.lineWidth
            : $height;
      }

      var $canvas = $(
        '<canvas width="' +
          $width +
          '" height="' +
          $height +
          '">Your browser does not support HTML5 Canvas.</canvas>'
      );

      $.canvas.object = $canvas[0].getContext("2d");

      if ($tooSmall) {
        // just create a rectangle of color...
        $.canvas.object.fillStyle = "#000";
        $.canvas.object.fillRect(0, 0, $width, $height);
      } else {
        this.setDefaults(true);
        this._drawshape($shape);
        console.log("41?");
      }

      $.canvas.object = $(".canvas:visible")[0].getContext("2d");

      // for now lets append it....
      // $('#canvas-wrapper').append($canvas);

      return $canvas;
    };
    $.canvas.items.curvedline_opposition._drawshape = function ($item) {
      console.log("42?");
      var endX = calculateRevX($item.x_percent) || $item.endX;
      var endY = calculateRevY($item.y_percent) || $item.endY;
      var startX = calculateRevX($item.x_start_percent) || $item.startX;
      var startY = calculateRevY($item.y_start_percent) || $item.startY;
      var centerX = calculateRevX($item.x_center_percent) || $item.centerX;
      var centerY = calculateRevY($item.y_center_percent) || $item.centerY;
      $.canvas.object.beginPath();
      $.canvas.object.moveTo(startX, startY);
      $.canvas.object.quadraticCurveTo(
        centerX,
        centerY,
        endX,
        endY
      );
      $.canvas.object.lineWidth = 2;
      if ($item.lines_color) {
        $.canvas.object.strokeStyle = $item.lines_color;
      }
      $.canvas.object.stroke();
      $.canvas.object.closePath();

      $.canvas.object.beginPath();

      $.canvas.object.lineWidth = 2;
      $.canvas.object.stroke();
      $.canvas.object.closePath();
      $.canvas.object.setLineDash([]);
    };

    //curled pass line (6th) bend with dot in it
    $.canvas.items.curledpassdotted_opposition = $.extend(
      true,
      {},
      $.canvas.items.base
    );
    //$.canvas.items.curledpassdotted_opposition.isdashed = true;
    $.canvas.items.curledpassdotted_opposition.defaults = {
      strokeStyle: "#E70E0E",
    };

    $.canvas.items.curledpassdotted_opposition.onMove = function (e) {
      e.stopPropagation();
      e.preventDefault();

      $(".canvas:visible").removeClass("move");
      if (this.isCollision(e)) {
        return;
      }

      if (!$.canvas.items.current.isDown) {
        return;
      }

      var mousePosition = $.canvas.getOffset(e);

      $.canvas.items.current.endX = mousePosition.x;
      $.canvas.items.current.endY = mousePosition.y;

      $.canvas.items.current.centerX = mousePosition.x;
      $.canvas.items.current.centerY = $.canvas.items.current.startY;

      $.canvas.reset();
    };
    $.canvas.items.curledpassdotted_opposition.drawHitArea = function ($item) {
      $shape = $.extend(true, {}, $item);
      var $width = $shape.endX - $shape.startX,
        $height = $shape.endY - $shape.startY;

      $shape.startX = 0;
      $shape.endX = $width;
      $shape.startY = 0;
      $shape.endY = $height;

      //flipped horz...
      if ($width < 0) {
        $width = $shape.startX - $shape.endX;
        $shape.startX = $width;
        $shape.endX = 0;
      }
      //flipped vert...
      if ($height < 0) {
        $height = $shape.startY - $shape.endY;
        $shape.startY = $height;
        $shape.endY = 0;
      }

      $shape.centerX = $shape.endX;
      $shape.centerY = $shape.startY;

      var $tooSmall = false;
      if (
        $height < this.hitAreaDefaults.lineWidth ||
        $width < this.hitAreaDefaults.lineWidth
      ) {
        $tooSmall = true;
        $width =
          $width < this.hitAreaDefaults.lineWidth
            ? this.hitAreaDefaults.lineWidth
            : $width;
        $height =
          $height < this.hitAreaDefaults.lineWidth
            ? this.hitAreaDefaults.lineWidth
            : $height;
      }

      var $canvas = $(
        '<canvas width="' +
          $width +
          '" height="' +
          $height +
          '">Your browser does not support HTML5 Canvas.</canvas>'
      );

      $.canvas.object = $canvas[0].getContext("2d");

      if ($tooSmall) {
        // just create a rectangle of color...
        $.canvas.object.fillStyle = "#000";
        $.canvas.object.fillRect(0, 0, $width, $height);
      } else {
        this.setDefaults(true);
        this._drawshape($shape);
        console.log("43?");
      }

      $.canvas.object = $(".canvas:visible")[0].getContext("2d");

      // for now lets append it....
      return $canvas;
    };
    $.canvas.items.curledpassdotted_opposition._drawshape = function ($item) {
      console.log("44?");
      var endX = calculateRevX($item.x_percent) || $item.endX;
      var endY = calculateRevY($item.y_percent) || $item.endY;
      var startX = calculateRevX($item.x_start_percent) || $item.startX;
      var startY = calculateRevY($item.y_start_percent) || $item.startY;
      var centerX = calculateRevX($item.x_center_percent) || $item.centerX;
      var centerY = calculateRevY($item.y_center_percent) || $item.centerY;
      $.canvas.object.beginPath();
      $.canvas.object.moveTo(startX, startY);
      $.canvas.object.quadraticCurveTo(
        centerX,
        centerY,
        endX,
        endY
      );
      $.canvas.object.lineWidth = 2;
      $.canvas.object.setLineDash([10, 2]);
      if ($item.lines_color) {
        $.canvas.object.strokeStyle = $item.lines_color;
      }
      $.canvas.object.stroke();
      $.canvas.object.closePath();

      $.canvas.object.beginPath();

      $.canvas.object.lineWidth = 2;
      $.canvas.object.stroke();
      $.canvas.object.closePath();

      // Add Arrow...
      if ($item.endX === $item.centerX && $item.endY === $item.centerY) {
        $.canvas.items.applyArrow(
          startX,
          startY,
          endX,
          endY
        );
      } else {
        $.canvas.items.applyArrow(
          centerX,
          centerY,
          endX,
          endY
        );
      }
    };

    // curved line dotted without arrow on head
    $.canvas.items.curvedottedline_opposition = $.extend(
      true,
      {},
      $.canvas.items.base
    );
    $.canvas.items.curvedottedline_opposition.defaults = {
      strokeStyle: "#E70E0E",
    };
    $.canvas.items.curvedottedline_opposition.onMove = function (e) {
      e.stopPropagation();
      e.preventDefault();

      $(".canvas:visible").removeClass("move");
      if (this.isCollision(e)) {
        return;
      }

      if (!$.canvas.items.current.isDown) {
        return;
      }

      var mousePosition = $.canvas.getOffset(e);

      $.canvas.items.current.endX = mousePosition.x;
      $.canvas.items.current.endY = mousePosition.y;

      $.canvas.items.current.centerX = mousePosition.x;
      $.canvas.items.current.centerY = $.canvas.items.current.startY;

      $.canvas.reset();
    };
    $.canvas.items.curvedottedline_opposition.drawHitArea = function ($item) {
      $shape = $.extend(true, {}, $item);
      var $width = $shape.endX - $shape.startX,
        $height = $shape.endY - $shape.startY;

      $shape.startX = 0;
      $shape.endX = $width;
      $shape.startY = 0;
      $shape.endY = $height;

      //flipped horz...
      if ($width < 0) {
        $width = $shape.startX - $shape.endX;
        $shape.startX = $width;
        $shape.endX = 0;
      }
      //flipped vert...
      if ($height < 0) {
        $height = $shape.startY - $shape.endY;
        $shape.startY = $height;
        $shape.endY = 0;
      }

      $shape.centerX = $shape.endX;
      $shape.centerY = $shape.startY;

      var $tooSmall = false;
      if (
        $height < this.hitAreaDefaults.lineWidth ||
        $width < this.hitAreaDefaults.lineWidth
      ) {
        $tooSmall = true;
        $width =
          $width < this.hitAreaDefaults.lineWidth
            ? this.hitAreaDefaults.lineWidth
            : $width;
        $height =
          $height < this.hitAreaDefaults.lineWidth
            ? this.hitAreaDefaults.lineWidth
            : $height;
      }

      var $canvas = $(
        '<canvas width="' +
          $width +
          '" height="' +
          $height +
          '">Your browser does not support HTML5 Canvas.</canvas>'
      );

      $.canvas.object = $canvas[0].getContext("2d");

      if ($tooSmall) {
        // just create a rectangle of color...
        $.canvas.object.fillStyle = "#000";
        $.canvas.object.fillRect(0, 0, $width, $height);
      } else {
        this.setDefaults(true);
        this._drawshape($shape);
        console.log("45?");
      }

      $.canvas.object = $(".canvas:visible")[0].getContext("2d");

      // for now lets append it....

      return $canvas;
    };
    $.canvas.items.curvedottedline_opposition._drawshape = function ($item) {
      console.log("46?");
      var endX = calculateRevX($item.x_percent) || $item.endX;
      var endY = calculateRevY($item.y_percent) || $item.endY;
      var startX = calculateRevX($item.x_start_percent) || $item.startX;
      var startY = calculateRevY($item.y_start_percent) || $item.startY;
      var centerX = calculateRevX($item.x_center_percent) || $item.centerX;
      var centerY = calculateRevY($item.y_center_percent) || $item.centerY;
      $.canvas.object.beginPath();
      $.canvas.object.moveTo(startX, startY);
      $.canvas.object.quadraticCurveTo(
        centerX,
        centerY,
        endX,
        endY
      );
      $.canvas.object.lineWidth = 2;
      $.canvas.object.setLineDash([10, 2]);
      if ($item.lines_color) {
        $.canvas.object.strokeStyle = $item.lines_color;
      }
      $.canvas.object.stroke();
      $.canvas.object.closePath();

      $.canvas.object.beginPath();

      $.canvas.object.lineWidth = 2;
      $.canvas.object.stroke();
      $.canvas.object.closePath();
      $.canvas.object.setLineDash([]);
    };

    //curled pass line circle on head(7th line)
    $.canvas.items.curledpasscirclehead_opposition = $.extend(
      true,
      {},
      $.canvas.items.base
    );
    $.canvas.items.curledpasscirclehead_opposition.defaults = {
      strokeStyle: "#E70E0E",
    };
    $.canvas.items.curledpasscirclehead_opposition.onMove = function (e) {
      e.stopPropagation();
      e.preventDefault();

      $(".canvas:visible").removeClass("move");
      if (this.isCollision(e)) {
        return;
      }

      if (!$.canvas.items.current.isDown) {
        return;
      }

      var mousePosition = $.canvas.getOffset(e);

      $.canvas.items.current.endX = mousePosition.x;
      $.canvas.items.current.endY = mousePosition.y;

      $.canvas.items.current.centerX = mousePosition.x;
      $.canvas.items.current.centerY = $.canvas.items.current.startY;

      $.canvas.reset();
    };
    $.canvas.items.curledpasscirclehead_opposition.drawHitArea = function (
      $item
    ) {
      $shape = $.extend(true, {}, $item);
      var $width = $shape.endX - $shape.startX,
        $height = $shape.endY - $shape.startY;

      $shape.startX = 0;
      $shape.endX = $width;
      $shape.startY = 0;
      $shape.endY = $height;

      //flipped horz...
      if ($width < 0) {
        $width = $shape.startX - $shape.endX;
        $shape.startX = $width;
        $shape.endX = 0;
      }
      //flipped vert...
      if ($height < 0) {
        $height = $shape.startY - $shape.endY;
        $shape.startY = $height;
        $shape.endY = 0;
      }

      $shape.centerX = $shape.endX;
      $shape.centerY = $shape.startY;

      var $tooSmall = false;
      if (
        $height < this.hitAreaDefaults.lineWidth ||
        $width < this.hitAreaDefaults.lineWidth
      ) {
        $tooSmall = true;
        $width =
          $width < this.hitAreaDefaults.lineWidth
            ? this.hitAreaDefaults.lineWidth
            : $width;
        $height =
          $height < this.hitAreaDefaults.lineWidth
            ? this.hitAreaDefaults.lineWidth
            : $height;
      }

      var $canvas = $(
        '<canvas width="' +
          $width +
          '" height="' +
          $height +
          '">Your browser does not support HTML5 Canvas.</canvas>'
      );

      $.canvas.object = $canvas[0].getContext("2d");

      if ($tooSmall) {
        // just create a rectangle of color...
        $.canvas.object.fillStyle = "#000";
        $.canvas.object.fillRect(0, 0, $width, $height);
      } else {
        this.setDefaults(true);
        this._drawshape($shape);
        console.log("47?");
      }

      $.canvas.object = $(".canvas:visible")[0].getContext("2d");

      return $canvas;
    };
    $.canvas.items.curledpasscirclehead_opposition._drawshape = function (
      $item
    ) {
      console.log("48?");
      var endX = calculateRevX($item.x_percent) || $item.endX;
      var endY = calculateRevY($item.y_percent) || $item.endY;
      var startX = calculateRevX($item.x_start_percent) || $item.startX;
      var startY = calculateRevY($item.y_start_percent) || $item.startY;
      var centerX = calculateRevX($item.x_center_percent) || $item.centerX;
      var centerY = calculateRevY($item.y_center_percent) || $item.centerY;
      $.canvas.object.beginPath();
      $.canvas.object.moveTo(startX, startY);
      $.canvas.object.quadraticCurveTo(
        centerX,
        centerY,
        endX,
        endY
      );
      $.canvas.object.lineWidth = 2;
      if ($item.lines_color) {
        $.canvas.object.strokeStyle = $item.lines_color;
      }
      $.canvas.object.stroke();
      $.canvas.object.closePath();

      $.canvas.object.beginPath();

      $.canvas.object.lineWidth = 2;
      $.canvas.object.stroke();
      $.canvas.object.closePath();

      // Add Arrow...
      if ($item.endX === $item.centerX && $item.endY === $item.centerY) {
        $.canvas.items.applyDot(
          startX,
          startY,
          endX,
          endY,
          $item.lines_color
        );
      } else {
        $.canvas.items.applyDot(
          centerX,
          centerY,
          endX,
          endY,
          $item.lines_color
        );
      }
    };

    //line no 10 having circle on both heads
    $.canvas.items.circleonbothhead_opposition = $.extend(
      true,
      {},
      $.canvas.items.base
    );
    $.canvas.items.circleonbothhead_opposition.defaults = {
      strokeStyle: "#E70E0E",
    };
    $.canvas.items.circleonbothhead_opposition.onMove = function (e) {
      e.stopPropagation();
      e.preventDefault();

      $(".canvas:visible").removeClass("move");
      if (this.isCollision(e)) {
        return;
      }

      if (!$.canvas.items.current.isDown) {
        return;
      }

      var mousePosition = $.canvas.getOffset(e);

      $.canvas.items.current.endX = mousePosition.x;
      $.canvas.items.current.endY = mousePosition.y;

      $.canvas.items.current.centerX = mousePosition.x;
      $.canvas.items.current.centerY = $.canvas.items.current.startY;

      $.canvas.reset();
    };
    $.canvas.items.circleonbothhead_opposition.drawHitArea = function ($item) {
      $shape = $.extend(true, {}, $item);
      var $width = $shape.endX - $shape.startX,
        $height = $shape.endY - $shape.startY;

      $shape.startX = 0;
      $shape.endX = $width;
      $shape.startY = 0;
      $shape.endY = $height;

      //flipped horz...
      if ($width < 0) {
        $width = $shape.startX - $shape.endX;
        $shape.startX = $width;
        $shape.endX = 0;
      }
      //flipped vert...
      if ($height < 0) {
        $height = $shape.startY - $shape.endY;
        $shape.startY = $height;
        $shape.endY = 0;
      }

      $shape.centerX = $shape.endX;
      $shape.centerY = $shape.startY;

      var $tooSmall = false;
      if (
        $height < this.hitAreaDefaults.lineWidth ||
        $width < this.hitAreaDefaults.lineWidth
      ) {
        $tooSmall = true;
        $width =
          $width < this.hitAreaDefaults.lineWidth
            ? this.hitAreaDefaults.lineWidth
            : $width;
        $height =
          $height < this.hitAreaDefaults.lineWidth
            ? this.hitAreaDefaults.lineWidth
            : $height;
      }

      var $canvas = $(
        '<canvas width="' +
          $width +
          '" height="' +
          $height +
          '">Your browser does not support HTML5 Canvas.</canvas>'
      );

      $.canvas.object = $canvas[0].getContext("2d");

      if ($tooSmall) {
        // just create a rectangle of color...
        $.canvas.object.fillStyle = "#000";
        $.canvas.object.fillRect(0, 0, $width, $height);
      } else {
        this.setDefaults(true);
        this._drawshape($shape);
        console.log("49?");
      }

      $.canvas.object = $(".canvas:visible")[0].getContext("2d");

      // for now lets append it....

      return $canvas;
    };
    $.canvas.items.circleonbothhead_opposition._drawshape = function ($item) {
      console.log("50?");
      var endX = calculateRevX($item.x_percent) || $item.endX;
      var endY = calculateRevY($item.y_percent) || $item.endY;
      var startX = calculateRevX($item.x_start_percent) || $item.startX;
      var startY = calculateRevY($item.y_start_percent) || $item.startY;
      var centerX = calculateRevX($item.x_center_percent) || $item.centerX;
      var centerY = calculateRevY($item.y_center_percent) || $item.centerY;
      $.canvas.items.applyDot(
        startX,
        startY,
        startX,
        startY,
        $item.lines_color
      );
    
      $.canvas.object.beginPath();
      $.canvas.object.moveTo(startX, startY);
    
      $.canvas.object.quadraticCurveTo(
        centerX,
        centerY,
        endX,
        endY
      );
      $.canvas.object.lineWidth = 2;
      if ($item.lines_color) {
        $.canvas.object.strokeStyle = $item.lines_color;
      }
      $.canvas.object.stroke();
      $.canvas.object.closePath();
    
      $.canvas.object.beginPath();
      // draw offset line, within bounds of drag area...
      $.canvas.object.lineWidth = 2;
      $.canvas.object.stroke();
      $.canvas.object.closePath();
    
      // Add Arrow...
      if (endX === centerX && endY === centerY) {
        $.canvas.items.applyDot(
          startX,
          startY,
          endX,
          endY,
          $item.lines_color
        );
      } else {
        $.canvas.items.applyDot(
          centerX,
          centerY,
          endX,
          endY,
          $item.lines_color
        );
      }
    };

    //line no 11 having circle on both heads
    $.canvas.items.circleonbothheaddotted_opposition = $.extend(
      true,
      {},
      $.canvas.items.base
    );
    $.canvas.items.circleonbothheaddotted_opposition.defaults = {
      strokeStyle: "#E70E0E",
    };
    $.canvas.items.circleonbothheaddotted_opposition.onMove = function (e) {
      e.stopPropagation();
      e.preventDefault();

      $(".canvas:visible").removeClass("move");
      if (this.isCollision(e)) {
        return;
      }

      if (!$.canvas.items.current.isDown) {
        return;
      }

      var mousePosition = $.canvas.getOffset(e);

      $.canvas.items.current.endX = mousePosition.x;
      $.canvas.items.current.endY = mousePosition.y;

      $.canvas.items.current.centerX = mousePosition.x;
      $.canvas.items.current.centerY = $.canvas.items.current.startY;

      $.canvas.reset();
    };
    $.canvas.items.circleonbothheaddotted_opposition.drawHitArea = function (
      $item
    ) {
      $shape = $.extend(true, {}, $item);
      var $width = $shape.endX - $shape.startX,
        $height = $shape.endY - $shape.startY;

      $shape.startX = 0;
      $shape.endX = $width;
      $shape.startY = 0;
      $shape.endY = $height;

      //flipped horz...
      if ($width < 0) {
        $width = $shape.startX - $shape.endX;
        $shape.startX = $width;
        $shape.endX = 0;
      }
      //flipped vert...
      if ($height < 0) {
        $height = $shape.startY - $shape.endY;
        $shape.startY = $height;
        $shape.endY = 0;
      }

      $shape.centerX = $shape.endX;
      $shape.centerY = $shape.startY;

      var $tooSmall = false;
      if (
        $height < this.hitAreaDefaults.lineWidth ||
        $width < this.hitAreaDefaults.lineWidth
      ) {
        $tooSmall = true;
        $width =
          $width < this.hitAreaDefaults.lineWidth
            ? this.hitAreaDefaults.lineWidth
            : $width;
        $height =
          $height < this.hitAreaDefaults.lineWidth
            ? this.hitAreaDefaults.lineWidth
            : $height;
      }

      var $canvas = $(
        '<canvas width="' +
          $width +
          '" height="' +
          $height +
          '">Your browser does not support HTML5 Canvas.</canvas>'
      );

      $.canvas.object = $canvas[0].getContext("2d");

      if ($tooSmall) {
        // just create a rectangle of color...
        $.canvas.object.fillStyle = "#000";
        $.canvas.object.fillRect(0, 0, $width, $height);
      } else {
        this.setDefaults(true);
        this._drawshape($shape);
        console.log("51?");
      }

      $.canvas.object = $(".canvas:visible")[0].getContext("2d");

      // for now lets append it....
      // $('#canvas-wrapper').append($canvas);

      return $canvas;
    };
    $.canvas.items.circleonbothheaddotted_opposition._drawshape = function (
      $item
    ) {
      console.log("52?");
      var endX = calculateRevX($item.x_percent) || $item.endX;
      var endY = calculateRevY($item.y_percent) || $item.endY;
      var startX = calculateRevX($item.x_start_percent) || $item.startX;
      var startY = calculateRevY($item.y_start_percent) || $item.startY;
      var centerX = calculateRevX($item.x_center_percent) || $item.centerX;
      var centerY = calculateRevY($item.y_center_percent) || $item.centerY;
      $.canvas.items.applyDot(
        startX,
        startY,
        startX,
        startY,
        $item.lines_color
      );
    
      $.canvas.object.beginPath();
      $.canvas.object.moveTo(startX, startY);
    
      $.canvas.object.quadraticCurveTo(
        centerX,
        centerY,
        endX,
        endY
      );
      $.canvas.object.lineWidth = 2;
      $.canvas.object.setLineDash([10, 2]);
      if ($item.lines_color) {
        $.canvas.object.strokeStyle = $item.lines_color;
      }
      $.canvas.object.stroke();
      $.canvas.object.closePath();
    
      $.canvas.object.beginPath();
    
      $.canvas.object.lineWidth = 2;
      if ($item.lines_color) {
        $.canvas.object.strokeStyle = $item.lines_color;
      }
      $.canvas.object.stroke();
      $.canvas.object.closePath();
    
      // Add Arrow...
      if (endX === centerX && endY === centerY) {
        $.canvas.items.applyDot(
          startX,
          startY,
          endX,
          endY,
          $item.lines_color
        );
      } else {
        $.canvas.items.applyDot(
          centerX,
          centerY,
          endX,
          endY,
          $item.lines_color
        );
      }
    };

    // circle_highlight opposition
    $.canvas.items.circle_highlight_opposition = $.extend(
      true,
      {},
      $.canvas.items.circle_highlight
    );
    $.canvas.items.circle_highlight_opposition.defaults = {
      strokeStyle: "#E70E0E",
      fillStyle: "rgba(0,0,0,0.3)",
    };

    // loftedpass_opposition opposition
    $.canvas.items.loftedpass_opposition = $.extend(
      true,
      {},
      $.canvas.items.base
    );
    $.canvas.items.loftedpass_opposition.defaults = {
      strokeStyle: "#E70E0E",
    };

    $.canvas.items.loftedpass_opposition.getCoords = function ($item) {
      var midPoint = $.canvas.items.getArcPoints(
          $item.startX,
          $item.startY,
          $item.endX,
          $item.endY
        ),
        left = $item.startX,
        right = $item.endX,
        top = midPoint.y,
        bottom = $item.endY;

      //flipped horz...
      if (left > right) {
        right = left;
        left = $item.endX;
      }

      //flipped vert...
      if ($item.startY > $item.endY) {
        bottom = $item.startY;
      }

      return { left: left, right: right, top: top, bottom: bottom };
    };

    $.canvas.items.loftedpass_opposition._drawshape = function ($item) {
      console.log("53?");
      // we should do the ratio calculation here so all stored data is consistant for loading asc files etc....
      var midPoint = $.canvas.items.getArcPoints(
        $item.startX,
        $item.startY,
        $item.endX,
        $item.endY
      );

      $.canvas.object.beginPath();
      $.canvas.object.moveTo($item.startX, $item.startY);
      $.canvas.object.quadraticCurveTo(
        midPoint.x,
        midPoint.y,
        $item.endX,
        $item.endY
      );
      $.canvas.object.lineWidth = 2;
      if ($item.lines_color) {
        $.canvas.object.strokeStyle = $item.lines_color;
      }
      $.canvas.object.stroke();
      $.canvas.object.closePath();

      // Add ellipse...
      $.canvas.object.lineWidth = 2;
      $.canvas.items.applyEllipse(
        $item.endX,
        $item.endY,
        80,
        30,
        "rgba(255,255,255,0.3)"
      );
      $.canvas.object.lineWidth = 2;
    };

    $.canvas.items.loftedpass_opposition.drawHitArea = function ($item) {
      $shape = $.extend(true, {}, $item);
      var midPoint = $.canvas.items.getArcPoints(
          $shape.startX,
          $shape.startY,
          $shape.endX,
          $shape.endY
        ),
        $width = $shape.endX - $shape.startX,
        $height = $shape.endY - midPoint.y;

      $shape.startX = 0;
      $shape.endX = $width;
      $shape.startY = $shape.startY - midPoint.y;
      $shape.endY = $height;

      //flipped horz...
      if ($item.startX > $item.endX) {
        $width = $item.startX - $item.endX;
        $shape.startX = $width;
        $shape.endX = 0;
      }
      //flipped vert...
      if ($item.startY > $item.endY) {
        $height = $item.startY - midPoint.y;
        $shape.endY = $item.endY - midPoint.y;
        $shape.startY = $height;
      }

      $height =
        $height < this.hitAreaDefaults.lineWidth
          ? this.hitAreaDefaults.lineWidth
          : $height;
      $width =
        $width < this.hitAreaDefaults.lineWidth
          ? this.hitAreaDefaults.lineWidth
          : $width;

      var $canvas = $(
        '<canvas style="background:aqua" width="' +
          $width +
          '" height="' +
          $height +
          '">Your browser does not support HTML5 Canvas.</canvas>'
      );

      $.canvas.object = $canvas[0].getContext("2d");

      this.setDefaults(true);
      this._drawshape($shape);
      console.log("54?");

      $.canvas.object = $(".canvas:visible")[0].getContext("2d");

      // for now lets append it....
      //$('#canvas-wrapper').append($canvas);

      return $canvas;
    };

    // running opposition
    $.canvas.items.running_opposition = $.extend(
      true,
      {},
      $.canvas.items.running
    );
    $.canvas.items.running_opposition.defaults = {
      strokeStyle: "#E70E0E",
    };

    // grid opposition
    $.canvas.items.grid_opposition = $.extend(true, {}, $.canvas.items.base);
    $.canvas.items.grid_opposition.defaults = {
      strokeStyle: "#E70E0E",
      fillStyle: "rgba(0,0,0,0.3)",
    };
    $.canvas.items.grid_opposition._drawshape = function ($item) {
      console.log("55?");
      var endX = calculateRevX($item.x_percent) || $item.endX;
      var endY = calculateRevY($item.y_percent) || $item.endY;
      var startX = calculateRevX($item.x_start_percent) || $item.startX;
      var startY = calculateRevY($item.y_start_percent) || $item.startY;
      var centerX = calculateRevX($item.x_center_percent) || $item.centerX;
      var centerY = calculateRevY($item.y_center_percent) || $item.centerY;
      $.canvas.object.beginPath();
      $.canvas.object.moveTo(startX, startY);
      $.canvas.object.lineTo(endX, startY);
      $.canvas.object.lineTo(endX, endY);
      $.canvas.object.lineTo(startX, endY);
      $.canvas.object.closePath();
      if ($item.shaded_shapes) {
        $.canvas.object.fillStyle = "rgba(0,0,0,0.3)";
        $.canvas.object.fill();
      }
      $.canvas.object.lineWidth = 2;
      if ($item.shapes_color) {
        $.canvas.object.strokeStyle = $item.shapes_color;
      }
      $.canvas.object.stroke();
    };

    //Triangle opposition
    $.canvas.items.triangle_opposition = $.extend(
      true,
      {},
      $.canvas.items.base
    );
    $.canvas.items.triangle_opposition.defaults = {
      strokeStyle: "#E70E0E",
      fillStyle: "rgb(0,0,0,0,0.3)",
    };
    $.canvas.items.triangle_opposition._drawshape = function ($item) {
      console.log("56?");
      var endX = calculateRevX($item.x_percent) || $item.endX;
      var endY = calculateRevY($item.y_percent) || $item.endY;
      var startX = calculateRevX($item.x_start_percent) || $item.startX;
      var startY = calculateRevY($item.y_start_percent) || $item.startY;
      var centerX = calculateRevX($item.x_center_percent) || $item.centerX;
      var centerY = calculateRevY($item.y_center_percent) || $item.centerY;
      $.canvas.object.beginPath();
      $.canvas.object.moveTo(startX, startY);
      $.canvas.object.lineTo(
        startX - (endX - startX),
        endY
      );
      $.canvas.object.lineTo(endX, endY);
      $.canvas.object.closePath();
      if ($item.shaded_shapes) {
        $.canvas.object.fillStyle = "rgba(0,0,0,0.3)";
        $.canvas.object.fill();
      }
      $.canvas.object.lineWidth = 2;
      if ($item.shapes_color) {
        $.canvas.object.strokeStyle = $item.shapes_color;
      }
      $.canvas.object.stroke();
    };

    // Diamond opposition
    $.canvas.items.square_opposition = $.extend(true, {}, $.canvas.items.base);
    $.canvas.items.square_opposition.defaults = {
      strokeStyle: "#E70E0E",
      fillStyle: "rgb(0,0,0,0,0.3)",
    };
    $.canvas.items.square_opposition._drawshape = function ($item) {
      console.log("57?");
      var endX = calculateRevX($item.x_percent) || $item.endX;
      var endY = calculateRevY($item.y_percent) || $item.endY;
      var startX = calculateRevX($item.x_start_percent) || $item.startX;
      var startY = calculateRevY($item.y_start_percent) || $item.startY;
      var centerX = calculateRevX($item.x_center_percent) || $item.centerX;
      var centerY = calculateRevY($item.y_center_percent) || $item.centerY;
      $.canvas.object.beginPath();
      $.canvas.object.moveTo(startX, startY);
      //$.canvas.object.lineTo($item.endX, $item.startY);
      $.canvas.object.lineTo(endX, endY);
      $.canvas.object.lineTo(startX, startY + endY);
      $.canvas.object.lineTo(
        startX - (endX - startX),
        endY
      );
      //
      $.canvas.object.closePath();
      if ($item.shaded_shapes) {
        $.canvas.object.fillStyle = "rgba(0,0,0,0.3)";
        $.canvas.object.fill();
      }
      $.canvas.object.lineWidth = 2;
      if ($item.shapes_color) {
        $.canvas.object.strokeStyle = $item.shapes_color;
      }
      $.canvas.object.stroke();
    };
    //Pentagon movement
    $.canvas.items.rhombus_opposition = $.extend(true, {}, $.canvas.items.base);
    $.canvas.items.rhombus_opposition.defaults = {
      strokeStyle: "#E70E0E",
    };
    $.canvas.items.rhombus_opposition._drawshape = function ($item) {
      console.log("58?");
      $.canvas.object.beginPath();
      $.canvas.object.moveTo($item.startX, $item.startY);
      //$.canvas.object.lineTo($item.endX, $item.startY);
      $.canvas.object.lineTo($item.endX, $item.endY);
      //$.canvas.object.lineTo($item.startX, ($item.startY + $item.endY));
      $.canvas.object.lineTo(
        $item.startX - ($item.endX - $item.startX),
        $item.endY
      );
      $.canvas.object.lineTo(
        $item.startX - ($item.endX - $item.startX),
        $item.endY
      );

      $.canvas.object.closePath();
      if ($item.shaded_shapes) {
        $.canvas.object.fillStyle = "rgba(0,0,0,0.3)";
        $.canvas.object.fill();
      }
      $.canvas.object.lineWidth = 2;
      if ($item.shapes_color) {
        $.canvas.object.strokeStyle = $item.shapes_color;
      }
      $.canvas.object.stroke();
    };

    // Rounded grid opposition

    $.canvas.items.grid_rounded_opposition = $.extend(
      true,
      {},
      $.canvas.items.base
    );
    $.canvas.items.grid_rounded_opposition.defaults = {
      strokeStyle: "#E70E0E",
      fillStyle: "rgba(0,0,0,0.3)",
    };
    $.canvas.items.grid_rounded_opposition._drawshape = function ($item) {
      console.log("59?");
      var endX = calculateRevX($item.x_percent) || $item.endX;
      var endY = calculateRevY($item.y_percent) || $item.endY;
      var startX = calculateRevX($item.x_start_percent) || $item.startX;
      var startY = calculateRevY($item.y_start_percent) || $item.startY;
      var centerX = calculateRevX($item.x_center_percent) || $item.centerX;
      var centerY = calculateRevY($item.y_center_percent) || $item.centerY;
      var x = startX,
        y = startY;
      var width,
        height,
        radius = 20;
      var dx = endX - startX;
      var dy = endY - startY;
      width = dx;
      height = dy;
      $.canvas.object.beginPath();
      if (width > 0) {
        if (height > 0) {
          $.canvas.object.moveTo(x + radius, y);
          $.canvas.object.lineTo(x + width - radius, y);
          $.canvas.object.quadraticCurveTo(x + width, y, x + width, y + radius);
          $.canvas.object.lineTo(x + width, y + height - radius);
          $.canvas.object.quadraticCurveTo(
            x + width,
            y + height,
            x + width - radius,
            y + height
          );
          $.canvas.object.lineTo(x + radius, y + height);
          $.canvas.object.quadraticCurveTo(
            x,
            y + height,
            x,
            y + height - radius
          );
          $.canvas.object.lineTo(x, y + radius);
          $.canvas.object.quadraticCurveTo(x, y, x + radius, y);
        } else {
          $.canvas.object.moveTo(x + radius, y);
          $.canvas.object.lineTo(x + width - radius, y);
          $.canvas.object.quadraticCurveTo(x + width, y, x + width, y - radius);
          $.canvas.object.lineTo(x + width, y + height + radius);
          $.canvas.object.quadraticCurveTo(
            x + width,
            y + height,
            x + width - radius,
            y + height
          );
          $.canvas.object.lineTo(x + radius, y + height);
          $.canvas.object.quadraticCurveTo(
            x,
            y + height,
            x,
            y + height + radius
          );
          $.canvas.object.lineTo(x, y - radius);
          $.canvas.object.quadraticCurveTo(x, y, x + radius, y);
        }
      } else {
        if (height > 0) {
          $.canvas.object.moveTo(x - radius, y);
          $.canvas.object.lineTo(x + width + radius, y);
          $.canvas.object.quadraticCurveTo(x + width, y, x + width, y + radius);
          $.canvas.object.lineTo(x + width, y + height - radius);
          $.canvas.object.quadraticCurveTo(
            x + width,
            y + height,
            x + width + radius,
            y + height
          );
          $.canvas.object.lineTo(x - radius, y + height);
          $.canvas.object.quadraticCurveTo(
            x,
            y + height,
            x,
            y + height - radius
          );
          $.canvas.object.lineTo(x, y + radius);
          $.canvas.object.quadraticCurveTo(x, y, x - radius, y);
        } else {
          $.canvas.object.moveTo(x - radius, y);
          $.canvas.object.lineTo(x + width + radius, y);
          $.canvas.object.quadraticCurveTo(x + width, y, x + width, y - radius);
          $.canvas.object.lineTo(x + width, y + height + radius);
          $.canvas.object.quadraticCurveTo(
            x + width,
            y + height,
            x + width + radius,
            y + height
          );
          $.canvas.object.lineTo(x - radius, y + height);
          $.canvas.object.quadraticCurveTo(
            x,
            y + height,
            x,
            y + height + radius
          );
          $.canvas.object.lineTo(x, y - radius);
          $.canvas.object.quadraticCurveTo(x, y, x - radius, y);
        }
      }
      $.canvas.object.closePath();
      if ($item.shaded_shapes) {
        $.canvas.object.fillStyle = "rgba(0,0,0,0.3)";
        $.canvas.object.fill();
      }
      $.canvas.object.lineWidth = 2;
      if ($item.shapes_color) {
        $.canvas.object.strokeStyle = $item.shapes_color;
      }
      $.canvas.object.stroke();
    };

    // grid_perspective_opposition
    $.canvas.items.grid_perspective_opposition = $.extend(
      true,
      {},
      $.canvas.items.grid_perspective
    );
    $.canvas.items.grid_perspective_opposition.defaults = {
      strokeStyle: "#E70E0E",
    };

    $.canvas.items.loftedpass = $.extend(true, {}, $.canvas.items.base);
    $.canvas.items.loftedpass.getCoords = function ($item) {
      var midPoint = $.canvas.items.getArcPoints(
          $item.startX,
          $item.startY,
          $item.endX,
          $item.endY
        ),
        left = $item.startX,
        right = $item.endX,
        top = midPoint.y,
        bottom = $item.endY;

      //flipped horz...
      if (left > right) {
        right = left;
        left = $item.endX;
      }

      //flipped vert...
      if ($item.startY > $item.endY) {
        bottom = $item.startY;
      }

      return { left: left, right: right, top: top, bottom: bottom };
    };

    $.canvas.items.loftedpass._drawshape = function ($item) {
      console.log("60?");
      // we should do the ratio calculation here so all stored data is consistant for loading asc files etc....
      var midPoint = $.canvas.items.getArcPoints(
        $item.startX,
        $item.startY,
        $item.endX,
        $item.endY
      );

      $.canvas.object.beginPath();
      $.canvas.object.moveTo($item.startX, $item.startY);
      $.canvas.object.quadraticCurveTo(
        midPoint.x,
        midPoint.y,
        $item.endX,
        $item.endY
      );
      $.canvas.object.lineWidth = 2;
      if ($item.shapes_color) {
        $.canvas.object.strokeStyle = $item.shapes_color;
      }
      $.canvas.object.stroke();
      $.canvas.object.closePath();

      // Add ellipse...
      $.canvas.object.lineWidth = 3;
      $.canvas.items.applyEllipse(
        $item.endX,
        $item.endY,
        80,
        30,
        "rgba(255,255,255,0.3)"
      );
      $.canvas.object.lineWidth = 3;
    };

    $.canvas.items.loftedpass.drawHitArea = function ($item) {
      $shape = $.extend(true, {}, $item);
      var midPoint = $.canvas.items.getArcPoints(
          $shape.startX,
          $shape.startY,
          $shape.endX,
          $shape.endY
        ),
        $width = $shape.endX - $shape.startX,
        $height = $shape.endY - midPoint.y;

      $shape.startX = 0;
      $shape.endX = $width;
      $shape.startY = $shape.startY - midPoint.y;
      $shape.endY = $height;

      //flipped horz...
      if ($item.startX > $item.endX) {
        $width = $item.startX - $item.endX;
        $shape.startX = $width;
        $shape.endX = 0;
      }
      //flipped vert...
      if ($item.startY > $item.endY) {
        $height = $item.startY - midPoint.y;
        $shape.endY = $item.endY - midPoint.y;
        $shape.startY = $height;
      }

      $height =
        $height < this.hitAreaDefaults.lineWidth
          ? this.hitAreaDefaults.lineWidth
          : $height;
      $width =
        $width < this.hitAreaDefaults.lineWidth
          ? this.hitAreaDefaults.lineWidth
          : $width;

      var $canvas = $(
        '<canvas style="background:aqua" width="' +
          $width +
          '" height="' +
          $height +
          '">Your browser does not support HTML5 Canvas.</canvas>'
      );

      $.canvas.object = $canvas[0].getContext("2d");

      this.setDefaults(true);
      this._drawshape($shape);
      console.log("61?");

      $.canvas.object = $(".canvas:visible")[0].getContext("2d");

      // for now lets append it....
      //$('#canvas-wrapper').append($canvas);

      return $canvas;
    };

    $.canvas.items.curledpass = $.extend(true, {}, $.canvas.items.base);
    $.canvas.items.curledpass.onMove = function (e) {
      e.stopPropagation();
      e.preventDefault();

      $(".canvas:visible").removeClass("move");
      if (this.isCollision(e)) {
        return;
      }

      if (!$.canvas.items.current.isDown) {
        return;
      }

      var mousePosition = $.canvas.getOffset(e);

      $.canvas.items.current.endX = mousePosition.x;
      $.canvas.items.current.endY = mousePosition.y;

      $.canvas.items.current.centerX = mousePosition.x;
      $.canvas.items.current.centerY = $.canvas.items.current.startY;

      $.canvas.reset();
    };
    $.canvas.items.curledpass.drawHitArea = function ($item) {
      $shape = $.extend(true, {}, $item);
      var $width = $shape.endX - $shape.startX,
        $height = $shape.endY - $shape.startY;

      $shape.startX = 0;
      $shape.endX = $width;
      $shape.startY = 0;
      $shape.endY = $height;

      //flipped horz...
      if ($width < 0) {
        $width = $shape.startX - $shape.endX;
        $shape.startX = $width;
        $shape.endX = 0;
      }
      //flipped vert...
      if ($height < 0) {
        $height = $shape.startY - $shape.endY;
        $shape.startY = $height;
        $shape.endY = 0;
      }

      $shape.centerX = $shape.endX;
      $shape.centerY = $shape.startY;

      var $tooSmall = false;
      if (
        $height < this.hitAreaDefaults.lineWidth ||
        $width < this.hitAreaDefaults.lineWidth
      ) {
        $tooSmall = true;
        $width =
          $width < this.hitAreaDefaults.lineWidth
            ? this.hitAreaDefaults.lineWidth
            : $width;
        $height =
          $height < this.hitAreaDefaults.lineWidth
            ? this.hitAreaDefaults.lineWidth
            : $height;
      }

      var $canvas = $(
        '<canvas width="' +
          $width +
          '" height="' +
          $height +
          '">Your browser does not support HTML5 Canvas.</canvas>'
      );

      $.canvas.object = $canvas[0].getContext("2d");

      if ($tooSmall) {
        // just create a rectangle of color...
        $.canvas.object.fillStyle = "#000";
        $.canvas.object.fillRect(0, 0, $width, $height);
      } else {
        this.setDefaults(true);
        this._drawshape($shape);
        console.log("62?");
      }

      $.canvas.object = $(".canvas:visible")[0].getContext("2d");

      // for now lets append it....
      // $('#canvas-wrapper').append($canvas);

      return $canvas;
    };
    $.canvas.items.curledpass._drawshape = function ($item) {
      console.log("63?");
      $.canvas.object.beginPath();
      $.canvas.object.moveTo($item.startX, $item.startY);
      $.canvas.object.quadraticCurveTo(
        $item.centerX,
        $item.centerY,
        $item.endX,
        $item.endY
      );
      $.canvas.object.lineWidth = 2;
      if ($item.lines_color) {
        $.canvas.object.strokeStyle = $item.lines_color;
      }
      $.canvas.object.stroke();
      $.canvas.object.closePath();

      $.canvas.object.beginPath();
      // draw offset line, within bounds of drag area...
      if ($item.startY > $item.endY) {
        $.canvas.object.moveTo($item.startX, $item.startY - 10);
        $.canvas.object.quadraticCurveTo(
          $item.centerX,
          $item.centerY - 5,
          $item.endX,
          $item.endY
        );
      } else {
        $.canvas.object.moveTo($item.startX, $item.startY + 10);
        $.canvas.object.quadraticCurveTo(
          $item.centerX,
          $item.centerY + 5,
          $item.endX,
          $item.endY
        );
      }
      $.canvas.object.lineWidth = 2;
      if ($item.lines_color) {
        $.canvas.object.strokeStyle = $item.lines_color;
      }
      $.canvas.object.stroke();
      $.canvas.object.closePath();

      // Add Arrow...
      if ($item.endX === $item.centerX && $item.endY === $item.centerY) {
        $.canvas.items.applyArrow(
          $item.startX,
          $item.startY,
          $item.endX,
          $item.endY
        );
      } else {
        $.canvas.items.applyArrow(
          $item.centerX,
          $item.centerY,
          $item.endX,
          $item.endY
        );
      }
    };

    $.canvas.items.bendpass = $.extend(true, {}, $.canvas.items.base);
    $.canvas.items.bendpass.onMove = function (e) {
      e.stopPropagation();
      e.preventDefault();

      $(".canvas:visible").removeClass("move");
      if (this.isCollision(e)) {
        return;
      }

      if (!$.canvas.items.current.isDown) {
        return;
      }

      var mousePosition = $.canvas.getOffset(e);

      $.canvas.items.current.endX = mousePosition.x;
      $.canvas.items.current.endY = mousePosition.y;

      $.canvas.items.current.centerX = $.canvas.items.current.startX;
      $.canvas.items.current.centerY = mousePosition.y;
      $.canvas.items.current.shapes_color = $(".shapes_color").css(
        "backgroundColor"
      );
      if ($("#shaded_shapes_button").hasClass("active_shade")) {
        $.canvas.items.current.shaded_shapes = "1";
      }
      $.canvas.reset();
    };
    $.canvas.items.bendpass.drawHitArea = function ($item) {
      $shape = $.extend(true, {}, $item);
      var $width = $shape.endX - $shape.startX,
        $height = $shape.endY - $shape.startY;

      $shape.startX = 0;
      $shape.endX = $width;
      $shape.startY = 0;
      $shape.endY = $height;

      //flipped horz...
      if ($width < 0) {
        $width = $shape.startX - $shape.endX;
        $shape.startX = $width;
        $shape.endX = 0;
      }
      //flipped vert...
      if ($height < 0) {
        $height = $shape.startY - $shape.endY;
        $shape.startY = $height;
        $shape.endY = 0;
      }

      $shape.centerX = $shape.startX;
      $shape.centerY = $shape.endY;

      var $tooSmall = false;
      if (
        $height < this.hitAreaDefaults.lineWidth ||
        $width < this.hitAreaDefaults.lineWidth
      ) {
        $tooSmall = true;
        $width =
          $width < this.hitAreaDefaults.lineWidth
            ? this.hitAreaDefaults.lineWidth
            : $width;
        $height =
          $height < this.hitAreaDefaults.lineWidth
            ? this.hitAreaDefaults.lineWidth
            : $height;
      }

      var $canvas = $(
        '<canvas width="' +
          $width +
          '" height="' +
          $height +
          '">Your browser does not support HTML5 Canvas.</canvas>'
      );

      $.canvas.object = $canvas[0].getContext("2d");

      if ($tooSmall) {
        // just create a rectangle of color...
        $.canvas.object.fillStyle = "#000";
        $.canvas.object.fillRect(0, 0, $width, $height);
      } else {
        this.setDefaults(true);
        this._drawshape($shape);
        console.log("64?");
      }

      $.canvas.object = $(".canvas:visible")[0].getContext("2d");

      // for now lets append it....
      // $('#canvas-wrapper').append($canvas);

      return $canvas;
    };
    $.canvas.items.bendpass._drawshape = function ($item) {
      console.log("65?");
      $.canvas.object.beginPath();
      $.canvas.object.moveTo($item.startX, $item.startY);
      $.canvas.object.quadraticCurveTo(
        $item.centerX,
        $item.centerY,
        $item.endX,
        $item.endY
      );
      $.canvas.object.lineWidth = 2;
      if ($item.shapes_color) {
        $.canvas.object.strokeStyle = $item.shapes_color;
      }
      $.canvas.object.stroke();
      $.canvas.object.closePath();

      $.canvas.object.beginPath();
      // draw offset line, within bounds of drag area...
      if ($item.startX > $item.endX) {
        $.canvas.object.moveTo($item.startX - 10, $item.startY);
        $.canvas.object.quadraticCurveTo(
          $item.centerX - 5,
          $item.centerY,
          $item.endX,
          $item.endY
        );
      } else {
        $.canvas.object.moveTo($item.startX + 10, $item.startY);
        $.canvas.object.quadraticCurveTo(
          $item.centerX + 5,
          $item.centerY,
          $item.endX,
          $item.endY
        );
      }
      $.canvas.object.lineWidth = 2;
      if ($item.shapes_color) {
        $.canvas.object.strokeStyle = $item.shapes_color;
      }
      $.canvas.object.stroke();
      $.canvas.object.closePath();

      // Add Arrow...
      if ($item.endX === $item.centerX && $item.endY === $item.centerY) {
        $.canvas.items.applyArrow(
          $item.startX,
          $item.startY,
          $item.endX,
          $item.endY
        );
      } else {
        $.canvas.items.applyArrow(
          $item.centerX,
          $item.centerY,
          $item.endX,
          $item.endY
        );
      }
    };

    $.canvas.items.grid_rounded = $.extend(true, {}, $.canvas.items.base);

    $.canvas.items.grid_rounded._drawshape = function ($item) {
      console.log("66?");
      var x = $item.startX,
        y = $item.startY;
      var width,
        height,
        radius = 20;
      var dx = $item.endX - $item.startX;
      var dy = $item.endY - $item.startY;
      width = dx;
      height = dy;
      $.canvas.object.beginPath();
      if (width > 0) {
        if (height > 0) {
          $.canvas.object.moveTo(x + radius, y);
          $.canvas.object.lineTo(x + width - radius, y);
          $.canvas.object.quadraticCurveTo(x + width, y, x + width, y + radius);
          $.canvas.object.lineTo(x + width, y + height - radius);
          $.canvas.object.quadraticCurveTo(
            x + width,
            y + height,
            x + width - radius,
            y + height
          );
          $.canvas.object.lineTo(x + radius, y + height);
          $.canvas.object.quadraticCurveTo(
            x,
            y + height,
            x,
            y + height - radius
          );
          $.canvas.object.lineTo(x, y + radius);
          $.canvas.object.quadraticCurveTo(x, y, x + radius, y);
        } else {
          $.canvas.object.moveTo(x + radius, y);
          $.canvas.object.lineTo(x + width - radius, y);
          $.canvas.object.quadraticCurveTo(x + width, y, x + width, y - radius);
          $.canvas.object.lineTo(x + width, y + height + radius);
          $.canvas.object.quadraticCurveTo(
            x + width,
            y + height,
            x + width - radius,
            y + height
          );
          $.canvas.object.lineTo(x + radius, y + height);
          $.canvas.object.quadraticCurveTo(
            x,
            y + height,
            x,
            y + height + radius
          );
          $.canvas.object.lineTo(x, y - radius);
          $.canvas.object.quadraticCurveTo(x, y, x + radius, y);
        }
      } else {
        if (height > 0) {
          $.canvas.object.moveTo(x - radius, y);
          $.canvas.object.lineTo(x + width + radius, y);
          $.canvas.object.quadraticCurveTo(x + width, y, x + width, y + radius);
          $.canvas.object.lineTo(x + width, y + height - radius);
          $.canvas.object.quadraticCurveTo(
            x + width,
            y + height,
            x + width + radius,
            y + height
          );
          $.canvas.object.lineTo(x - radius, y + height);
          $.canvas.object.quadraticCurveTo(
            x,
            y + height,
            x,
            y + height - radius
          );
          $.canvas.object.lineTo(x, y + radius);
          $.canvas.object.quadraticCurveTo(x, y, x - radius, y);
        } else {
          $.canvas.object.moveTo(x - radius, y);
          $.canvas.object.lineTo(x + width + radius, y);
          $.canvas.object.quadraticCurveTo(x + width, y, x + width, y - radius);
          $.canvas.object.lineTo(x + width, y + height + radius);
          $.canvas.object.quadraticCurveTo(
            x + width,
            y + height,
            x + width + radius,
            y + height
          );
          $.canvas.object.lineTo(x - radius, y + height);
          $.canvas.object.quadraticCurveTo(
            x,
            y + height,
            x,
            y + height + radius
          );
          $.canvas.object.lineTo(x, y - radius);
          $.canvas.object.quadraticCurveTo(x, y, x - radius, y);
        }
      }
      $.canvas.object.closePath();
      $.canvas.object.lineWidth = 2;
      if ($item.shapes_color) {
        $.canvas.object.strokeStyle = $item.shapes_color;
      }
      $.canvas.object.stroke();
    };

    $.canvas.items.grid = $.extend(true, {}, $.canvas.items.base);
    $.canvas.items.grid._drawshape = function ($item) {
      console.log("67?");
      $.canvas.object.beginPath();
      $.canvas.object.moveTo($item.startX, $item.startY);
      $.canvas.object.lineTo($item.endX, $item.startY);
      $.canvas.object.lineTo($item.endX, $item.endY);
      $.canvas.object.lineTo($item.startX, $item.endY);
      $.canvas.object.closePath();
      $.canvas.object.lineWidth = 2;
      if ($item.shapes_color) {
        $.canvas.object.strokeStyle = $item.shapes_color;
      }
      $.canvas.object.stroke();
    };
    $.canvas.items.grid_perspective = $.extend(true, {}, $.canvas.items.grid);
    $.canvas.items.grid_perspective._drawshape = function ($item) {
      console.log("68?");
      var endX = calculateRevX($item.x_percent) || $item.endX;
      var endY = calculateRevY($item.y_percent) || $item.endY;
      var startX = calculateRevX($item.x_start_percent) || $item.startX;
      var startY = calculateRevY($item.y_start_percent) || $item.startY;
      var centerX = calculateRevX($item.x_center_percent) || $item.centerX;
      var centerY = calculateRevY($item.y_center_percent) || $item.centerY;
      var width = startX - startY;
      if (width < 0) {
        width = width * -1;
      }

      var skewBy = 3200; // flash 800 * flash ratio (1920 / 484)

      $.canvas.object.beginPath();
      $.canvas.object.moveTo(
        startX +
          ((endX - startX) * (endY - startY)) / skewBy,
        startY
      );
      $.canvas.object.lineTo(
        endX -
          ((endX - startX) * (endY - startY)) / skewBy,
        startY
      );
      $.canvas.object.lineTo(endX, endY);
      $.canvas.object.lineTo(startX, endY);
      $.canvas.object.lineTo(
        startX +
          ((endX - startX) * (endY - startY)) / skewBy,
        startY
      );
      $.canvas.object.closePath();
      if ($item.shaded_shapes) {
        $.canvas.object.fillStyle = "rgba(0,0,0,0.3)";
        $.canvas.object.fill();
      }
      $.canvas.object.lineWidth = 2;
      if ($item.shapes_color) {
        $.canvas.object.strokeStyle = $item.shapes_color;
      }
      $.canvas.object.stroke();
    };

    $.canvas.items.grid_rounded_perspective = $.extend(
      true,
      {},
      $.canvas.items.grid
    );
    $.canvas.items.grid_rounded_perspective._drawshape = function ($item) {
      console.log("69?");
      var endX = calculateRevX($item.x_percent) || $item.endX;
      var endY = calculateRevY($item.y_percent) || $item.endY;
      var startX = calculateRevX($item.x_start_percent) || $item.startX;
      var startY = calculateRevY($item.y_start_percent) || $item.startY;
      var centerX = calculateRevX($item.x_center_percent) || $item.centerX;
      var centerY = calculateRevY($item.y_center_percent) || $item.centerY;
      var skewBy = 3200;
      var radius = 20;
      var width = endX - startX;
      var height = endY - startY;
      $.canvas.object.beginPath();
      if (width > 0) {
        if (height > 0) {
          // top line
          $.canvas.object.moveTo(
            startX +
              ((endX - startX) * (endY - startY)) /
                skewBy +
              radius,
            startY
          );
          $.canvas.object.lineTo(
            endX -
              ((endX - startX) * (endY - startY)) /
                skewBy -
              radius,
            startY
          );
          $.canvas.object.quadraticCurveTo(
            endX -
              ((endX - startX) * (endY - startY)) /
                skewBy,
            startY,
            endX -
              ((endX - startX) * (endY - startY)) /
                skewBy,
            startY + radius
          );

          // right line
          $.canvas.object.lineTo(endX, endY - radius);
          $.canvas.object.quadraticCurveTo(
            endX,
            endY,
            endX - radius,
            endY
          );

          // bottom line
          $.canvas.object.lineTo(startX + radius, endY);
          $.canvas.object.quadraticCurveTo(
            startX,
            endY,
            startX,
            endY - radius
          );

          // left line
          $.canvas.object.lineTo(
            startX +
              ((endX - startX) * (endY - startY)) /
                skewBy,
            startY + radius
          );
          $.canvas.object.quadraticCurveTo(
            startX +
              ((endX - startX) * (endY - startY)) /
                skewBy,
            startY,
            startX +
              ((endX - startX) * (endY - startY)) /
                skewBy +
              radius,
            startY
          );
        } else {
          // bottom line
          $.canvas.object.moveTo(
            startX +
              ((endX - startX) * (endY - startY)) /
                skewBy +
              radius,
            startY
          );
          $.canvas.object.lineTo(
            endX -
              ((endX - startX) * (endY - startY)) /
                skewBy -
              radius,
            startY
          );
          $.canvas.object.quadraticCurveTo(
            endX -
              ((endX - startX) * (endY - startY)) /
                skewBy,
            startY,
            endX -
              ((endX - startX) * (endY - startY)) /
                skewBy,
            startY - radius
          );

          // right line
          $.canvas.object.lineTo(endX, endY + radius);
          $.canvas.object.quadraticCurveTo(
            endX,
            endY,
            endX - radius,
            endY
          );

          // top line
          $.canvas.object.lineTo(startX + radius, endY);
          $.canvas.object.quadraticCurveTo(
            startX,
            endY,
            startX,
            endY + radius
          );

          // left line
          $.canvas.object.lineTo(
            startX +
              ((endX - startX) * (endY - startY)) /
                skewBy,
            startY - radius
          );
          $.canvas.object.quadraticCurveTo(
            startX +
              ((endX - startX) * (endY - startY)) /
                skewBy,
            startY,
            startX +
              ((endX - startX) * (endY - startY)) /
                skewBy +
              radius,
            startY
          );
        }
      } else {
        if (height > 0) {
          // top line
          $.canvas.object.moveTo(
            startX +
              ((endX - startX) * (endY - startY)) /
                skewBy -
              radius,
            startY
          );
          $.canvas.object.lineTo(
            endX -
              ((endX - startX) * (endY - startY)) /
                skewBy +
              radius,
            startY
          );
          $.canvas.object.quadraticCurveTo(
            endX -
              ((endX - startX) * (endY - startY)) /
                skewBy,
            startY,
            endX -
              ((endX - startX) * (endY - startY)) /
                skewBy,
            startY + radius
          );

          // left line
          $.canvas.object.lineTo(endX, endY - radius);
          $.canvas.object.quadraticCurveTo(
            endX,
            endY,
            endX + radius,
            endY
          );

          // bottom line
          $.canvas.object.lineTo(startX - radius, endY);
          $.canvas.object.quadraticCurveTo(
            startX,
            endY,
            startX,
            endY - radius
          );

          // right line
          $.canvas.object.lineTo(
            startX +
              ((endX - startX) * (endY - startY)) /
                skewBy,
            startY + radius
          );
          $.canvas.object.quadraticCurveTo(
            startX +
              ((endX - startX) * (endY - startY)) /
                skewBy,
            startY,
            startX +
              ((endX - startX) * (endY - startY)) /
                skewBy -
              radius,
            startY
          );
        } else {
          // bottom line
          $.canvas.object.moveTo(
            startX +
              ((endX - startX) * (endY - startY)) /
                skewBy -
              radius,
            startY
          );
          $.canvas.object.lineTo(
            endX -
              ((endX - startX) * (endY - startY)) /
                skewBy +
              radius,
            startY
          );
          $.canvas.object.quadraticCurveTo(
            endX -
              ((endX - startX) * (endY - startY)) /
                skewBy,
            startY,
            endX -
              ((endX - startX) * (endY - startY)) /
                skewBy,
            startY - radius
          );

          // left line
          $.canvas.object.lineTo(endX, endY + radius);
          $.canvas.object.quadraticCurveTo(
            endX,
            endY,
            endX + radius,
            endY
          );

          // top line
          $.canvas.object.lineTo(startX - radius, endY);
          $.canvas.object.quadraticCurveTo(
            startX,
            endY,
            startX,
            endY + radius
          );

          // right line
          $.canvas.object.lineTo(
            startX +
              ((endX - startX) * (endY - startY)) /
                skewBy,
            startY - radius
          );
          $.canvas.object.quadraticCurveTo(
            startX +
              ((endX - startX) * (endY - startY)) /
                skewBy,
            startY,
            startX +
              ((endX - startX) * (endY - startY)) /
                skewBy -
              radius,
            startY
          );
        }
      }
      if ($item.shaded_shapes) {
        $.canvas.object.fillStyle = "rgba(0,0,0,0.3)";
        $.canvas.object.fill();
      }
      $.canvas.object.lineWidth = 2;
      if ($item.shapes_color) {
        $.canvas.object.strokeStyle = $item.shapes_color;
      }

      $.canvas.object.stroke();
    };

    // grid_rounded_perspective opposition
    $.canvas.items.grid_rounded_perspective_opposition = $.extend(
      true,
      {},
      $.canvas.items.grid_rounded_perspective
    );
    $.canvas.items.grid_rounded_perspective_opposition.defaults = {
      strokeStyle: "#E70E0E",
    };
  })(jQuery);

  
}

function calculateXPercent(endX) {
    // (endX - LEFT_FROM_SHEET) * 100) / PITCH-WIDTH-FROM-SHEET
    //   );
    // alert("bacsdasd")
    if (
      (window.innerWidth >= 1024) &
      (window.innerWidth < 1280) &
      ((window.innerHeight >= 1366) & (window.innerHeight < 1440))
    ) {
      console.log("a")
      return parseFloat(((endX - 196) * 100) / 632);
    } else if (
      (window.innerWidth >= 1366) &
      (window.innerWidth < 1440) &
      ((window.innerHeight >= 1024) & (window.innerHeight < 1280))
    ) {
      console.log("b")
      return parseFloat(((endX - 260) * 100) / 838);
    } else if (
      (window.innerWidth >= 768) &
      (window.innerWidth < 1024) &
      ((window.innerHeight >= 1024) & (window.innerHeight < 1280))
    ) {
      // alert()
      console.log("c")
      return parseFloat(((endX - 145) * 100) / 473); //--
    } else if (
      (window.innerWidth >= 1024) &
      (window.innerWidth < 1280) &
      ((window.innerHeight >= 768) & (window.innerHeight < 1024))
    ) {
      console.log("d")
      return parseFloat(((endX - 195) * 100) / 632);
    } else if (
      (window.innerWidth >= 1336) &
      (window.innerWidth < 1440) &
      ((window.innerHeight >= 768) & (window.innerHeight < 1024))
    ) {
      console.log("e")
      return parseFloat(((endX - 260) * 100) / 840); //--
    } else if (
      (window.innerWidth >= 1920) &
      (window.innerWidth < 2560) &
      ((window.innerHeight >= 1080) & (window.innerHeight < 1200))
    ) {
      console.log("f")
      return parseFloat(((endX - 363) * 100) / 1183);
    } else if (
      (window.innerWidth >= 1536) &
      (window.innerWidth < 1920) &
      ((window.innerHeight >= 864) & (window.innerHeight < 900))
    ) {
      console.log("g")
      return parseFloat(((endX - 290) * 100) / 847);
    } else if (
      (window.innerWidth >= 1440) &
      (window.innerWidth < 1536) &
      ((window.innerHeight >= 900) & (window.innerHeight < 1080))
    ) {
      console.log("h")
      return parseFloat(((endX - 273) * 100) / 889); //-
    } else if (
      (window.innerWidth >= 1280) &
      (window.innerWidth < 1366) &
      ((window.innerHeight >= 720) & (window.innerHeight < 800))
    ) {
      console.log("i")
      return parseFloat(((endX - 243) * 100) / 791);
    } else if (
      (window.innerWidth >= 1280) &
      (window.innerWidth < 1366) &
      ((window.innerHeight >= 800) & (window.innerHeight < 900))
    ) {
      console.log("j")
      return parseFloat(((endX - 242) * 100) / 790); //-
    } else if (
      (window.innerWidth >= 1920) &
      (window.innerWidth < 2560) &
      ((window.innerHeight >= 1200) & (window.innerHeight < 1080))
    ) {
      console.log("k")
      return parseFloat(((endX - 365) * 100) / 1184);
    } else if (
      (window.innerWidth >= 1920) &
      (window.innerWidth < 2560) &
      ((window.innerHeight >= 1080) & (window.innerHeight < 1440))
    ) {
      console.log("l")
      return parseFloat(((endX - 365) * 100) / 1182); //-
    } else if (
      (window.innerWidth >= 2560) &
      (window.innerWidth < 3840) &
      ((window.innerHeight >= 1440) & (window.innerHeight < 2160))
    ) {
      console.log("m")
      return parseFloat(((endX - 490) * 100) / 1576);
    } else if (
      (window.innerWidth >= 3840) &
      (window.innerWidth < 5120) &
      ((window.innerHeight >= 2160) & (window.innerHeight < 2880))
    ) {
      console.log("n")
      return parseFloat(((endX - 730) * 100) / 2373);
    } else if ((window.innerWidth >= 5120) & (window.innerHeight >= 2880)) {
      console.log("o")
      return parseFloat(((endX - 970) * 100) / 3160);
    }
  }

  function calculateYPercent(endY) {
    // (endX - LEFT_FROM_SHEET) * 100) / PITCH-WIDTH-FROM-SHEET
    //   );
    // alert(window.innerWidth + " ")
    if (
      (window.innerWidth >= 1024) &
      (window.innerWidth < 1280) &
      ((window.innerHeight >= 1366) & (window.innerHeight < 1440))
    ) {
      return parseFloat(((endY - 405) * 100) / 415);
    } else if (
      (window.innerWidth >= 1366) &
      (window.innerWidth < 1440) &
      ((window.innerHeight >= 1024) & (window.innerHeight < 1280))
    ) {
      return parseFloat(((endY - 163) * 100) / 557);
    } else if (
      (window.innerWidth >= 768) &
      (window.innerWidth < 1024) &
      ((window.innerHeight >= 1024) & (window.innerHeight < 1280))
    ) {
      return parseFloat(((endY - 290) * 100) / 311); //--
    } else if (
      (window.innerWidth >= 1000) &
      (window.innerWidth < 1280) &
      ((window.innerHeight >= 750) & (window.innerHeight < 1024))
    ) {
      return parseFloat(((endY - 116) * 100) / 416);
    } else if (
      (window.innerWidth >= 1336) &
      (window.innerWidth < 1440) &
      ((window.innerHeight >= 768) & (window.innerHeight < 1024))
    ) {
      return parseFloat(((endY - 60) * 100) / 553); //--
    } else if (
      (window.innerWidth >= 1920) &
      (window.innerWidth < 2560) &
      ((window.innerHeight >= 1080) & (window.innerHeight < 1200))
    ) {
      return parseFloat(((endY - 77) * 100) / 776);
    } else if (
      (window.innerWidth >= 1536) &
      (window.innerWidth < 1920) &
      ((window.innerHeight >= 864) & (window.innerHeight < 900))
    ) {
      return parseFloat(((endY - 50) * 100) / 624);
    } else if (
      (window.innerWidth >= 1440) &
      (window.innerWidth < 1536) &
      ((window.innerHeight >= 900) & (window.innerHeight < 1080))
    ) {
      return parseFloat(((endY - 87) * 100) / 587); //-
    } else if (
      (window.innerWidth >= 1280) &
      (window.innerWidth < 1366) &
      ((window.innerHeight >= 720) & (window.innerHeight < 800))
    ) {
      return parseFloat(((endY - 31) * 100) / 523);
    } else if (
      (window.innerWidth >= 1280) &
      (window.innerWidth < 1366) &
      ((window.innerHeight >= 800) & (window.innerHeight < 900))
    ) {
      return parseFloat(((endY - 72) * 100) / 520); //-
    } else if (
      (window.innerWidth >= 1920) &
      (window.innerWidth < 2560) &
      ((window.innerHeight >= 1200) & (window.innerHeight < 1080))
    ) {
      return parseFloat(((endY - 140) * 100) / 799);
    } else if (
      (window.innerWidth >= 1920) &
      (window.innerWidth < 2560) &
      ((window.innerHeight >= 1080) & (window.innerHeight < 1440))
    ) {
      return parseFloat(((endY - 80) * 100) / 784); //-
    } else if (
      (window.innerWidth >= 2560) &
      (window.innerWidth < 3840) &
      ((window.innerHeight >= 1440) & (window.innerHeight < 2160))
    ) {
      return parseFloat(((endY - 124) * 100) / 1041);
    } else if (
      (window.innerWidth >= 3840) &
      (window.innerWidth < 5120) &
      ((window.innerHeight >= 2160) & (window.innerHeight < 2880))
    ) {
      return parseFloat(((endY - 221) * 100) / 1560);
    } else if ((window.innerWidth >= 5120) & (window.innerHeight >= 2880)) {
      return parseFloat(((endY - 315) * 100) / 2078);
    }
  }
function calculateRevX(x_percent) {
  if (
    (window.innerWidth >= 1024) &
    (window.innerWidth < 1280) &
    ((window.innerHeight >= 1366) & (window.innerWidth < 1440))
  ) {
    return parseFloat((x_percent * 632) / 100 + 196);
  } else if (
    (window.innerWidth >= 1366) &
    (window.innerWidth < 1440) &
    ((window.innerHeight >= 1024) & (window.innerHeight < 1280))
  ) {
    return parseFloat((x_percent * 838) / 100 + 260);
  } else if (
    (window.innerWidth >= 768) &
    (window.innerWidth < 1024) &
    ((window.innerHeight >= 1024) & (window.innerHeight < 1280))
  ) {
    return parseFloat((x_percent * 473) / 100 + 145); //--
  } else if (
    (window.innerWidth >= 1024) &
    (window.innerWidth < 1280) &
    ((window.innerHeight >= 768) & (window.innerHeight < 1024))
  ) {
    return parseFloat((x_percent * 632) / 100 + 195);
  } else if (
    (window.innerWidth >= 1336) &
    (window.innerWidth < 1440) &
    ((window.innerHeight >= 768) & (window.innerHeight < 1024))
  ) {
    return parseFloat((x_percent * 840) / 100 + 260); //--
  } else if (
    (window.innerWidth >= 1920) &
    (window.innerWidth < 2560) &
    ((window.innerHeight >= 1080) & (window.innerHeight < 1200))
  ) {
    return parseFloat((x_percent * 1183) / 100 + 363);
  } else if (
    (window.innerWidth >= 1536) &
    (window.innerWidth < 1920) &
    ((window.innerHeight >= 864) & (window.innerHeight < 900))
  ) {
    return parseFloat((x_percent * 847) / 100 + 290) + 50;
  } else if (
    (window.innerWidth >= 1440) &
    (window.innerWidth < 1536) &
    ((window.innerHeight >= 900) & (window.innerHeight < 1080))
  ) {
    return parseFloat((x_percent * 889) / 100 + 273); //-
  } else if (
    (window.innerWidth >= 1280) &
    (window.innerWidth < 1366) &
    ((window.innerHeight >= 720) & (window.innerHeight < 800))
  ) {
    return parseFloat((x_percent * 791) / 100 + 243);
  } else if (
    (window.innerWidth >= 1280) &
    (window.innerWidth < 1366) &
    ((window.innerHeight >= 800) & (window.innerHeight < 900))
  ) {
    return parseFloat((x_percent * 790) / 100 + 242); //-
  } else if (
    (window.innerWidth >= 1920) &
    (window.innerWidth < 2560) &
    ((window.innerHeight >= 1200) & (window.innerHeight < 1080))
  ) {
    return parseFloat((x_percent * 1184) / 100 + 365);
  } else if (
    (window.innerWidth >= 1920) &
    (window.innerWidth < 2560) &
    ((window.innerHeight >= 1080) & (window.innerHeight < 1440))
  ) {
    return parseFloat((x_percent * 1182) / 100 + 365); //-
  } else if (
    (window.innerWidth >= 2560) &
    (window.innerWidth < 3840) &
    ((window.innerHeight >= 1440) & (window.innerHeight < 2160))
  ) {
    return parseFloat((x_percent * 1576) / 100 + 490);
  } else if (
    (window.innerWidth >= 3840) &
    (window.innerWidth < 5120) &
    ((window.innerHeight >= 2160) & (window.innerHeight < 2880))
  ) {
    return parseFloat((x_percent * 2373) / 100 + 730);
  } else if ((window.innerWidth >= 5120) & (window.innerHeight >= 2880)) {
    return parseFloat((x_percent * 3160) / 100 + 970);
  }
}

function calculateRevY(y_percent) {
  if (
    (window.innerWidth >= 1024) &
    (window.innerWidth < 1280) &
    ((window.innerHeight >= 1366) & (window.innerWidth < 1440))
  ) {
    return parseFloat((y_percent * 415) / 100 + 405);
  } else if (
    (window.innerWidth >= 1366) &
    (window.innerWidth < 1440) &
    ((window.innerHeight >= 1024) & (window.innerHeight < 1280))
  ) {
    return parseFloat((y_percent * 557) / 100 + 163);
  } else if (
    (window.innerWidth >= 768) &
    (window.innerWidth < 1024) &
    ((window.innerHeight >= 1024) & (window.innerHeight < 1280))
  ) {
    return parseFloat((y_percent * 311) / 100 + 290) -30; //--
  } else if (
    (window.innerWidth >= 1024) &
    (window.innerWidth < 1280) &
    ((window.innerHeight >= 768) & (window.innerHeight < 1024))
  ) {
    return parseFloat((y_percent * 416) / 100 + 116);
  } else if (
    (window.innerWidth >= 1336) &
    (window.innerWidth < 1440) &
    ((window.innerHeight >= 768) & (window.innerHeight < 1024))
  ) {
    return parseFloat((y_percent * 553) / 100 + 60) - 30; //--
  } else if (
    (window.innerWidth >= 1920) &
    (window.innerWidth < 2560) &
    ((window.innerHeight >= 1080) & (window.innerHeight < 1200))
  ) {
    return parseFloat((y_percent * 776) / 100 + 77);
  } else if (
    (window.innerWidth >= 1536) &
    (window.innerWidth < 1920) &
    ((window.innerHeight >= 864) & (window.innerHeight < 900))
  ) {
    return parseFloat((y_percent * 624) / 100 + 50);
  } else if (
    (window.innerWidth >= 1440) &
    (window.innerWidth < 1536) &
    ((window.innerHeight >= 900) & (window.innerHeight < 1080))
  ) {
    return parseFloat((y_percent * 587) / 100 + 87); //-
  } else if (
    (window.innerWidth >= 1280) &
    (window.innerWidth < 1366) &
    ((window.innerHeight >= 720) & (window.innerHeight < 800))
  ) {
    return parseFloat((y_percent * 523) / 100 + 31);
  } else if (
    (window.innerWidth >= 1280) &
    (window.innerWidth < 1366) &
    ((window.innerHeight >= 800) & (window.innerHeight < 900))
  ) {
    return parseFloat((y_percent * 250) / 100 + 72); //-
  } else if (
    (window.innerWidth >= 1920) &
    (window.innerWidth < 2560) &
    ((window.innerHeight >= 1200) & (window.innerHeight < 1080))
  ) {
    return parseFloat((y_percent * 799) / 100 + 140);
  } else if (
    (window.innerWidth >= 1920) &
    (window.innerWidth < 2560) &
    ((window.innerHeight >= 1080) & (window.innerHeight < 1440))
  ) {
    return parseFloat((y_percent * 784) / 100 + 80) + 50; //-
  } else if (
    (window.innerWidth >= 2560) &
    (window.innerWidth < 3840) &
    ((window.innerHeight >= 1440) & (window.innerHeight < 2160))
  ) {
    return parseFloat((y_percent * 1041) / 100 + 124);
  } else if (
    (window.innerWidth >= 3840) &
    (window.innerWidth < 5120) &
    ((window.innerHeight >= 2160) & (window.innerHeight < 2880))
  ) {
    return parseFloat((y_percent * 1560) / 100 + 221);
  } else if ((window.innerWidth >= 5120) & (window.innerHeight >= 2880)) {
    return parseFloat((y_percent * 2078) / 100 + 315);
  }
}
function drawshape_players($item, $i, obj) {
  console.log("70?");
  var cache = $item.cache,
    offset = 5;

  if (cache && cache.img) {
    if (
      navigator.appName == "Microsoft Internet Explorer" ||
      !!(
        navigator.userAgent.match(/Trident/) ||
        navigator.userAgent.match(/rv:11/)
      ) ||
      (typeof $.browser !== "undefined" && $.browser.msie == 1)
    ) {
      var cacheimg = new Image();
      cacheimg.src = cache.img.href;
      cacheimg.onload = function () {
        $.canvas.object.drawImage(
          cache.img,
          cache.left,
          cache.top,
          cache.width,
          cache.height
        );
      };
    } else {
      console.log("-------------------------");
      console.log($item);
      console.log("-------------------------");
      if ($item.x_percent == undefined) {
        var lefts = cache.left;
        var tops = cache.top;
      } else {
        console.log("*******************");
        var lefts = calculateRevX($item.x_percent) - cache.width / 2;
        var tops = calculateRevY($item.y_percent) - cache.height / 2;
        console.log(
          calculateRevY($item.y_percent) + " calculateRevY($item.y_percent)"
        );
        console.log(
          calculateRevX($item.x_percent) + "calculateRevX($item.x_percent)"
        );
        // var lefts = parseFloat(
        //   ($item.x_percent * $(".canvas:visible").width()) / 100
        // ); // - (cache.width/2);
        // var tops = parseFloat(
        //   ($item.y_percent * $(".canvas:visible").height()) / 100
        // ); // - parseFloat($("body").css("font-size").replace("px", "")) - 7;
      }
      $.canvas.object.drawImage(
        cache.img,
        lefts,
        tops,
        cache.width,
        cache.height
      );
    }

    $.canvas.object.save();

    // apply text shadow...
    var d_pitches_array = [
      "pitch_18",
      "pitch_19",
      "pitch_20",
      "pitch_21",
      "pitch_22",
      "pitch_23",
      "pitch_24",
      "pitch_25",
      "pitch_26",
      "pitch_27",
      "pitch_28",
      "pitch_29",
      "pitch_30",
      "pitch_31",
      "pitch_32",
      "pitch_33",
      "pitch_34",
      "pitch_36",
      "pitch_37",
      "pitch_38",
      "pitch_39",
      "pitch_43",
      "pitch_44",
      "pitch_46",
      "pitch_47",
      "pitch_48",
      "pitc_49",
      "pitch_50",
      "pitch_52",
      "pitch_53",
      "pitch_54",
      "pitch_55",
      "pitch_56",
      "pitch_57",
      "pitch_58",
      "pitch_59",
      "pitch_60",
      "pitch_61",
      "pitch_62",
      "pitch_63",
      "pitch_64",
      "pitch_65",
      "pitch_66",
      "pitch_67",
      "pitch_68",
    ];
    $.each(d_pitches_array, function (key, value) {
      if ($.canvas.items.pitch.current == d_pitches_array[key]) {
        $.canvas.object.shadowColor = "rgba(0,0,0,0.45)";
        $.canvas.object.shadowOffsetX = 2;
        $.canvas.object.shadowOffsetY = 3;
        $.canvas.object.shadowBlur = 2;
      }
    });

    if (
      navigator.userAgent.toLowerCase().indexOf("firefox") > -1 ||
      navigator.userAgent.toLowerCase().indexOf("msie") > -1 ||
      navigator.userAgent.toLowerCase().indexOf("trident") > -1
    ) {
      // firefox
      if ($item.text) {
        if ($item.color) {
          if (
            $item.type == "player_circle_3" ||
            $item.type == "player_circle_6" ||
            $item.type == "player_circle_7" ||
            $item.type == "player_circle_8" ||
            $item.type == "player_circle_81"
          ) {
            $.canvas.object.fillStyle = $item.color;
          } else {
            $.canvas.object.fillStyle = "#fff";
          }
        } else {
          if (
            $item.type == "player_circle_3" ||
            $item.type == "player_circle_6" ||
            $item.type == "player_circle_7"
          ) {
            $.canvas.object.fillStyle = "#2A67B2";
          } else if (
            $item.type == "player_circle_8" ||
            $item.type == "player_circle_81"
          ) {
            $.canvas.object.fillStyle = "#EE220D";
          } else {
            $.canvas.object.fillStyle = "#fff";
          }
        }

        if (
          $item.type == "player_circle_3" ||
          $item.type == "player_circle_6" ||
          $item.type == "player_circle_8" ||
          $item.type == "player_circle_81"
        ) {
          obj.fontSize = 11;
          console.log("pitch a 19");
          // $.canvas.object.beginPath();
          // $.canvas.object.arc(lefts + cache.width / 3.25, tops - obj.fontSize / 2 + cache.height / 2.5 - offset + 2, 12, 0, 2 * Math.PI);
          // $.canvas.object.fillStyle = "red";
          // $.canvas.object.fill();
          $.canvas.object.font =
            "normal normal bold 2.75em 'Neue Haas Grotesk Display Pro' ";

          $.canvas.object.fillText(
            $item.text,
            lefts + cache.width / 2 - offset + obj.fontSize / 5,
            tops - obj.fontSize + cache.height / 2 - offset
            // cache.left + cache.width / 2,
            // cache.top - obj.fontSize / 2 + cache.height / 2 - offset + 2
          );
        } else if ($item.type == "player_circle_7") {
          // $.canvas.object.beginPath();
          // $.canvas.object.arc(lefts + cache.width / 3.25, tops - obj.fontSize / 2 + cache.height / 2.5 - offset + 1, 12, 0, 2 * Math.PI);
          // $.canvas.object.fillStyle = "red";
          // $.canvas.object.fill();
          $.canvas.object.font =
            "normal normal bold 2.75em 'Neue Haas Grotesk Display Pro' ";
          // $.canvas.object.fillStyle = "#fff";
          $.canvas.object.fillText(
            $item.text,
            lefts + cache.width / 2,
            tops - obj.fontSize / 2 + cache.height / 2 - offset + 1
          );
        } else {
          // console.log(lefts)
          // console.log("((((((((((((((")
          // $.canvas.object.beginPath();
          // $.canvas.object.arc(lefts + cache.width / 3.25, tops - obj.fontSize / 2 + cache.height / 2.5 - offset + 4, 12, 0, 2 * Math.PI);
          // $.canvas.object.fillStyle = "red";
          // $.canvas.object.fill();
          $.canvas.object.font =
            "normal normal bold 2.75em 'Neue Haas Grotesk Display Pro 75 Bold' ";
          // $.canvas.object.fillStyle = "#fff";
          $.canvas.object.fillText(
            $item.text,
            lefts + cache.width / 2 - offset + obj.fontSize / 5,
            tops - obj.fontSize + cache.height / 2 - offset
          );
        }
      }
      if ($item.abovename) {
        if (
          $.canvas.items.pitch.colour == "mono" ||
          $.canvas.items.pitch.colour == "plane-white"
        ) {
          $.canvas.object.fillStyle = "#929292";
        } else {
          $.canvas.object.fillStyle = "#fff";
        }
        $.canvas.object.font = '15px "Helvetica Neue", Helvetica, Arial';
        $.canvas.object.fillText(
          $item.abovename,
          lefts + cache.width / 2,
          tops - obj.namefontSize / 2 + cache.height / 2 - offset - 25
        );
      }

      if ($item.abovecomment) {
        if (
          $.canvas.items.pitch.colour == "mono" ||
          $.canvas.items.pitch.colour == "plane-white"
        ) {
          $.canvas.object.fillStyle = "#929292";
        } else {
          $.canvas.object.fillStyle = "#fff";
        }
        $.canvas.object.font = '15px "Helvetica Neue", Helvetica, Arial';

        var comment = $item.abovecomment;
        var split_comment = comment
          .replace(/.{30}\S*\s+/g, "$&@")
          .split(/\s+@/);
        var one = split_comment[0];
        var two = split_comment[1];
        var three = split_comment[2];
        var four = split_comment[3];

        if (two === undefined) {
          $.canvas.object.fillText(
            one,
            lefts + cache.width / 2,
            tops - 45 - obj.commentfontSize / 2 + cache.height - offset - 25
          );
        } else if (three === undefined) {
          $.canvas.object.fillText(
            two,
            cache.left + cache.width / 2,
            cache.top -
              45 -
              obj.commentfontSize / 2 +
              cache.height -
              offset -
              25
          );
          $.canvas.object.fillText(
            one,
            cache.left + cache.width / 2,
            cache.top -
              65 -
              obj.commentfontSize / 2 +
              cache.height -
              offset -
              25
          );
        } else if (four === undefined) {
          $.canvas.object.fillText(
            three,
            cache.left + cache.width / 2,
            cache.top -
              45 -
              obj.commentfontSize / 2 +
              cache.height -
              offset -
              25
          );
          $.canvas.object.fillText(
            two,
            cache.left + cache.width / 2,
            cache.top -
              65 -
              obj.commentfontSize / 2 +
              cache.height -
              offset -
              25
          );
          $.canvas.object.fillText(
            one,
            cache.left + cache.width / 2,
            cache.top -
              84 -
              obj.commentfontSize / 2 +
              cache.height -
              offset -
              25
          );
        } else {
          $.canvas.object.fillText(
            four,
            cache.left + cache.width / 2,
            cache.top -
              45 -
              obj.commentfontSize / 2 +
              cache.height -
              offset -
              25
          );
          $.canvas.object.fillText(
            three,
            cache.left + cache.width / 2,
            cache.top -
              65 -
              obj.commentfontSize / 2 +
              cache.height -
              offset -
              25
          );
          $.canvas.object.fillText(
            two,
            cache.left + cache.width / 2,
            cache.top -
              84 -
              obj.commentfontSize / 2 +
              cache.height -
              offset -
              25
          );
          $.canvas.object.fillText(
            one,
            cache.left + cache.width / 2,
            cache.top -
              105 -
              obj.commentfontSize / 2 +
              cache.height -
              offset -
              25
          );
        }
      }
    } else {
      // chrome
      if ($item.text) {
        $.canvas.object.font =
          setFontNumber();
        $.canvas.object.shadowBlur = 4;
        $.canvas.object.shadowColor = "black";
        if ($item.color) {
          if (
            // $item.type == "player_circle_3" ||
            // $item.type == "player_circle_6" ||
            $item.type == "player_circle_7" ||
            $item.type == "player_circle_8" ||
            $item.type == "player_circle_81"
          ) {
            // $.canvas.object.fillStyle = $item.color;
            $.canvas.object.fillStyle = "#fff";
          } else {
            $.canvas.object.fillStyle = "#fff";
            $.canvas.object.font =
            setFontNumber();
        $.canvas.object.shadowBlur = 4;
        $.canvas.object.shadowColor = "black";
          }
        } else {
          if (
            // $item.type == "player_circle_3" ||
            // $item.type == "player_circle_6" ||
            $item.type == "player_circle_7"
          ) {
            $.canvas.object.fillStyle = "#fff"; //2A67B2
            $.canvas.object.font =
            setFontNumber();
            $.canvas.object.shadowBlur = 4;
            $.canvas.object.shadowColor = "black";
          } else if (
            $item.type == "player_circle_8" ||
            $item.type == "player_circle_81"
          ) {
            $.canvas.object.fillStyle = "#EE220D";
          } else if (
            $item.type == "player_circle_4" ||
            $item.type == "player_circle_5" ||
            $item.type == "player_circle_6"
          ) {
            // $.canvas.object.transform(1, 0, -0.5, 1, 0, 0);
            $.canvas.object.fillStyle = "#fff";
            $.canvas.object.font =
            setFontNumber();
            $.canvas.object.shadowBlur = 10;
            $.canvas.object.shadowColor = "black";
          } else {
            $.canvas.object.fillStyle = "#fff";
            $.canvas.object.font = setFontNumber();
            $.canvas.object.shadowBlur = 10;
            $.canvas.object.shadowColor = "black";
          }
        }
        if (
          // $item.type == "player_circle_3" ||
          // $item.type == "player_circle_6" ||
          $item.type == "player_circle_8" ||
          $item.type == "player_circle_81"
        ) {
          obj.fontSize = 10;
          $.canvas.object.fillText(
            $item.text,
            cache.left + cache.width / 2,
            cache.top - obj.fontSize / 2 + cache.height / 2 - offset
          );
        } else if ($item.type == "player_circle_6") {
          $.canvas.object.fillText(
            $item.text,
            cache.left + cache.width / 2,
            cache.top - obj.fontSize / 2 + cache.height / 2 - offset + 4
          );
        } else if ($item.type == "player_circle_7") {
          $.canvas.object.fillText(
            $item.text,
            cache.left + cache.width / 2,
            cache.top - obj.fontSize / 2 + cache.height / 2 - offset - 2
          );
        } else if ($item.type == "player_circle_6") {
          $.canvas.object.fillText(
            $item.text,
            cache.left + cache.width / 2,
            cache.top - obj.fontSize / 2 + cache.height / 2 - offset - 2
          );
        } else {
          $.canvas.object.fillText(
            $item.text,
            lefts + cache.width / 2,
            setFontNumberPosition(tops - obj.fontSize / 2 + cache.height / 2 - offset + 3)
          );
        }
      }
      if ($item.abovename) {
        if (
          $.canvas.items.pitch.colour == "mono" ||
          $.canvas.items.pitch.colour == "plane-white"
        ) {
          $.canvas.object.fillStyle = "#929292";
        } else {
          $.canvas.object.fillStyle = "#fff";
        }
        $.canvas.object.font = setFontName();

        $.canvas.object.fillText(
          $item.abovename,
          lefts + cache.width / 2,
          setFontNamePosition(tops - obj.namefontSize / 2 + cache.height / 2 - offset - 25)
        );
      }
      if ($item.abovecomment) {
        if (
          $.canvas.items.pitch.colour == "mono" ||
          $.canvas.items.pitch.colour == "plane-white"
        ) {
          $.canvas.object.fillStyle = "#929292";
        } else {
          $.canvas.object.fillStyle = "#fff";
        }
        $.canvas.object.font = setFontComment();
    
        var comment = $item.abovecomment;
        var split_comment = comment
          .replace(/.{30}\S*\s+/g, "$&@")
          .split(/\s+@/);
        var one = split_comment[0];
        var two = split_comment[1];
        var three = split_comment[2];
        var four = split_comment[3];
    
        if (two === undefined) {
          $.canvas.object.fillText(
            one,
            lefts + cache.width / 2,
            setFontCommentPosition(tops -
                45 -
                obj.commentfontSize / 2 +
                cache.height -
                offset -
                25)
          );
        } else if (three === undefined) {
          $.canvas.object.fillText(
            two,
            lefts + cache.width / 2,
            setFontCommentPosition(
            tops -
              45 -
              obj.commentfontSize / 2 +
              cache.height -
              offset -
              25
            )
          );
          $.canvas.object.fillText(
            one,
            lefts + cache.width / 2,
            setFontCommentPosition(
            tops -
              65 -
              obj.commentfontSize / 2 +
              cache.height -
              offset -
              25
            )
          );
        } else if (four === undefined) {
          $.canvas.object.fillText(
            three,
            lefts + cache.width / 2,
            setFontCommentPosition(
            tops -
              45 -
              obj.commentfontSize / 2 +
              cache.height -
              offset -
              25
            )
          );
          $.canvas.object.fillText(
            two,
            lefts + cache.width / 2,
            setFontCommentPosition(
            tops -
              65 -
              obj.commentfontSize / 2 +
              cache.height -
              offset -
              25
            )
          );
          $.canvas.object.fillText(
            one,
            lefts + cache.width / 2,
            setFontCommentPosition(
            tops -
              84 -
              obj.commentfontSize / 2 +
              cache.height -
              offset -
              25
            )
          );
        } else {
          $.canvas.object.fillText(
            four,
            lefts + cache.width / 2,
            setFontCommentPosition(
            tops -
              45 -
              obj.commentfontSize / 2 +
              cache.height -
              offset -
              25
            )
          );
          $.canvas.object.fillText(
            three,
            lefts + cache.width / 2,
            setFontCommentPosition(
            tops -
              65 -
              obj.commentfontSize / 2 +
              cache.height -
              offset -
              25
            )
          );
          $.canvas.object.fillText(
            two,
            lefts + cache.width / 2,
            setFontCommentPosition(
            tops -
              84 -
              obj.commentfontSize / 2 +
              cache.height -
              offset -
              25
            )
          );
          $.canvas.object.fillText(
            one,
            lefts + cache.width / 2,
            setFontCommentPosition(
            tops -
              105 -
              obj.commentfontSize / 2 +
              cache.height -
              offset -
              25
            )
          );
        }
      }
    }

    $.canvas.object.restore();

    setTextPosition($item, obj);
  }
}

function setFontNumber(){
  if(window.innerWidth > 1920){
    return "bold 50px 'Neue Haas Grotesk Display Pro 75 Bold'"
  }
  else{
    return "bold 15px 'Neue Haas Grotesk Display Pro 75 Bold'"
  }
}

function setFontName(){
  if(window.innerWidth > 1920){
    return '30px "Helvetica Neue", Helvetica, Arial'
  }
  else{
    return '15px "Helvetica Neue", Helvetica, Arial'
  }
}

function setFontComment(){
  if(window.innerWidth > 1920){
    return '30px "Helvetica Neue", Helvetica, Arial'
  }
  else{
    return '15px "Helvetica Neue", Helvetica, Arial'
  }
}

function setFontNumberPosition(y){
  if(window.innerWidth > 1920){
    return y - 12
  }else{
    return y
  }
}

function setFontNamePosition(y){
  if(window.innerWidth > 1920){
    return y - 50
  }else{
    return y
  }
}

function setFontCommentPosition(y){
  if(window.innerWidth > 1920){
    return y - 100
  }else{
    return y
  }
}

function setTextPosition($item, obj) {
  var $editableTextShape = $("#canvas-text"),
    zoomBy = 1 + $.canvas.zoomTracking / 10,
    offset = 3,
    padding = parseFloat($("body").css("font-size").replace("px", "")),
    x =
      ($item.cache.left / $.canvas.scaledRatio) * zoomBy +
      padding +
      $.canvas.panX,
    y =
      (($item.cache.top - obj.fontSize / 2 + $item.cache.height / 2) /
        $.canvas.scaledRatio) *
        zoomBy +
      padding -
      offset +
      $.canvas.panY,
    width = ($item.cache.width / $.canvas.scaledRatio) * zoomBy;

  if (
    navigator.userAgent.toLowerCase().indexOf("firefox") > -1 ||
    navigator.userAgent.toLowerCase().indexOf("msie") > -1 ||
    navigator.userAgent.toLowerCase().indexOf("trident") > -1
  ) {
    // firefox
    if ($item.name == "above-name") {
      $editableTextShape.css({
        "font-size": "20px",
        left: x - 11 + "px",
        top: y - 45 + "px",
        width: width + "px",
      });
    } else if ($item.name == "above-comment") {
      $editableTextShape.css({
        "font-size": "20px",
        left: x - 39 + "px",
        top: y - 75 + "px",
        width: width + 50 + "px",
      });
    } else {
      $editableTextShape.css({
        "font-size": (obj.fontSize / $.canvas.scaledRatio) * zoomBy + "px",
        left: x - 8 + "px",
        top: y - 10 + "px",
        width: width + "px",
      });
    }
  } else if (navigator.appVersion.indexOf("Mac") > 0) {
    // MAC
    if ($item.name == "above-name") {
      $editableTextShape.css({
        "font-size": "20px",
        left: x - 11 + "px",
        top: y - 45 + "px",
        width: width + "px",
      });
    } else if ($item.name == "above-comment") {
      $editableTextShape.css({
        "font-size": "20px",
        left: x - 39 + "px",
        top: y - 75 + "px",
        width: width + 50 + "px",
      });
    } else {
      obj.fontSize = 12;
      $editableTextShape.css({
        "font-size": (obj.fontSize / $.canvas.scaledRatio) * zoomBy + "px",
        left: x - 11 + "px",
        top: y - 14 + "px",
        width: width + "px",
      });
    }
  } else {
    // chrome

    if ($item.name == "above-name") {
      $editableTextShape.css({
        "font-size": "10px",
        left: x - 11 + "px",
        top: y - 45 + "px",
        width: width + "px",
      });
    } else if ($item.name == "above-comment") {
      $editableTextShape.css({
        "font-size": "20px",
        left: x - 39 + "px",
        top: y - 75 + "px",
        width: width + 50 + "px",
      });
    } else {
      $editableTextShape.css({
        "font-size": (obj.fontSize / $.canvas.scaledRatio) * zoomBy + "px",
        left: x - 5 + "px",
        top: y + 15 + "px",
        width: width + "px",
      });
    }
  }
}
function setResize() {
  (function ($) {
    $.scale = {
      width: 960,
      height: 700,
      ratio: 900 / 700,
      fontRatio: 900 / 700,
      init: function () {
        $(window).on("resize resizeend", $.scale.resize);
        $.scale.resize();
      },
      resize: function () {
        $("#canvas-text").blur();
        // If our ratio is too wide, calculate font size based on height
        if ($(window).width() / $(window).height() > $.scale.ratio) {
          fontsize = $(window).height() / $.scale.height;
        } else {
          fontsize = $(window).width() / $.scale.width;
        }
        $("body").css({ fontSize: fontsize + "em" });

        $.formAutosize.refresh();

        // Check if the canvas fits within it's new area... if not scale it further...
        var width = $(".canvas-content:visible").width(),
          height = $(".canvas-content:visible").outerHeight(),
          maxheight = $("#main-content").outerHeight(),
          ratio = maxheight / height,
          zoomBy = 1 + $.canvas.zoomTracking / 10;
        $(".canvas-content:visible").css({
          "max-width": Math.floor(width * ratio) + "px",
        });
        var canvas_content_width = $(".canvas-content:visible").width();
        var canvas_content_height = $(".canvas-content:visible").height();
        $.canvas.scaledSize = {
          width: $(".canvas:visible").width(),
          height: $(".canvas:visible").height(),
        };
        var canvas_notes_height =
          canvas_content_height - $.canvas.scaledSize.height - 25;
        $("#canvas-notes").height(canvas_notes_height);
        $.canvas.scaledRatio = $.canvas.size.width / $.canvas.scaledSize.width;
        $("#pitch-scale").html(
          ".drag-helper.enlarge {-webkit-transform: scale(" +
            ($.canvas.scaledSize.width / $.canvas.size.width) * zoomBy +
            ");transform: scale(" +
            ($.canvas.scaledSize.width / $.canvas.size.width) * zoomBy +
            ");}"
        );
      },
    };
    $.scale.init();
  })(jQuery);
}
function set_practice_info(obj) {
  if ($(obj).val()) {
    $.canvas.history.doAutoSave();
  }
}

function isMobile() {
  return "ontouchstart" in document.documentElement;
}

function set_default_lines_color_on_pitch(pitch_color) {
  if (pitch_color === "mono") {
    $(".select_team_color .color_light_blue").css({
      backgroundColor: "black",
    });
    $(".shapes_color").css({
      backgroundColor: "black",
    });
    $(".text-tools-colors").css({
      backgroundColor: "black",
    });
  } else {
    $(".select_team_color .color_light_blue").css({
      backgroundColor: "white",
    });
    $(".shapes_color").css({
      backgroundColor: "white",
    });
    $(".text-tools-colors").css({
      backgroundColor: "black",
    });
  }
}
function save_canvas_session(exported_session_plan, is_export, canvas_image) {
  var site_url = baseURL;
  var postData = $("#sessionplanner").serializeArray();
  console.log(postData);
  var session_information = $(".save-session-form").serializeArray();
  $.ajax({
    method: "POST",
    url:
      baseURL +
      "/index.php?option=com_sessioncreatorv1&task=sessioncreatorv1.saveSession&tmpl=component",
    data: {
      practice_notes_data: postData,
      history: JSON.stringify(obj_history),
      session_information: session_information,
      pitch_number: pitch_number,
      exported_session_plan: exported_session_plan,
      canvas_image: canvas_image,
    },
    dataType: "json",
    // async: false,
    success: function (result) {
      if (result.session_id) {
        $("#downloadForm").remove();
        var session_id = result.session_id;
        var session_name = result.session_name;
        var user_id = $("#user_id").val();
        $("#session_id").val(session_id);
        $("#session-main-title").html(session_name);
        try {
          localStorage.setItem("session_id", session_id);
        } catch (ex) {}
        var imageUrl = $(".logoimage").attr("src");

        $(
          "<div id='downloadForm' style='display: none;'><iframe name='downloadFormIframe'></iframe></div>"
        ).appendTo("body");

        if (is_export) {
          $(
            "<form action='" +
              site_url +
              "' target='downloadFormIframe' method='post'>" +
              canvas_image_url +
              "<input type='hidden' name='exported_session_plan' value='" +
              exported_session_plan +
              "'/><input type='hidden' name='user_id' value='" +
              user_id +
              "'/><input type='hidden' name='session_id' value='" +
              session_id +
              "'/><input type='hidden' name='is_export' value='" +
              is_export +
              "'/><input type='hidden' name='option' value='com_sessioncreatorv1'/><input type='hidden' name='task' value='sessioncreatorv1.saveTTAjax'/><input type='hidden' name='controller' value='sessioncreatorv1'/><input type='hidden' name='imageUrl' value='" +
              imageUrl +
              "'/></form>"
          )
            .appendTo("#downloadForm")
            .submit();
          exportedPdf();
          function exportedPdf() {
            $.ajax({
              method: "POST",
              url:
                baseURL +
                "/index.php?option=com_sessioncreatorv1&task=sessioncreatorv1.checkPdfGenerated&tmpl=component",
              data: { user_id: $("#user_id").val(), session_id: session_id },
              dataType: "json",
              async: false,
              success: function (result) {
                if (!result) {
                  setTimeout(function () {
                    // exportedPdf();
                  }, 1000);
                  $(".modal-backdrop").remove();
                } else {
                  $(".modal-backdrop").remove();
                }
              },
            });
          }
          $.canvas.history.clearAutoSave();
          //$(".save_session_container").hide();
          $.dialog.confirm({
            title: "",
            description: "Session Plan downloaded to your files area",
            cancelText: "OK",
            callback: function () {},
          });
        }
        $.canvas.history.clearAutoSave();
        //$(".save_session_container").hide();
        $.dialog.confirm({
          title: "",
          description: "Session Saved Successfully",
          cancelText: "OK",
          callback: function () {},
        });
      }
      $(".save_session_container").hide();
      $("img.loader-img").css("display", "none");
    },
  });
}
//crop canvas image in pdf
function crop_canvas_img(orgImg) {
  var canvas = document.createElement("canvas");
  canvas.width = orgImg.width - 70;
  canvas.height = orgImg.height;
  var ctx = canvas.getContext("2d");
  ctx.drawImage(orgImg, 0, 0);
  var imageData = ctx.getImageData(70, 0, canvas.width, canvas.height);

  // create destiantion canvas
  var canvas1 = document.createElement("canvas");
  canvas1.width = canvas.width;
  canvas1.height = canvas.height;
  var ctx1 = canvas1.getContext("2d");
  ctx1.rect(0, 0, canvas1.width, canvas1.height);
  ctx1.fillStyle = "white";
  ctx1.fill();
  ctx1.putImageData(imageData, 0, 0);

  return canvas1.toDataURL("image/png");
}
