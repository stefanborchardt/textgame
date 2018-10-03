(function(m,d,y,h){d[m]=y.call(d);for(var g=0;g<h.length;g++)h[g](d[m]);"undefined"!=typeof module&&module.exports?module.exports=d[m]:"function"==typeof define&&define.amd&&define(function(){return d[m]})})("Primus",this||{},function(){var m,h=function(){function g(v,x,_){function k(E,S){if(!x[E]){if(!v[E]){var O="function"==typeof require&&require;if(!S&&O)return O(E,!0);if(b)return b(E,!0);var L=new Error("Cannot find module '"+E+"'");throw L.code="MODULE_NOT_FOUND",L}var q=x[E]={exports:{}};v[E][0].call(q.exports,function(T){var C=v[E][1][T];return k(C||T)},q,q.exports,g,v,x,_)}return x[E].exports}for(var b="function"==typeof require&&require,w=0;w<_.length;w++)k(_[w]);return k}return g}()({1:[function(g,v){"use strict";v.exports=function(k,b){function w(S,O){if(b[S]){if("string"==typeof b[S]&&(b[S]=b[S].split(E)),"function"==typeof b[S])return b[S].call(O);for(var q,T,L=0;L<b[S].length;L++)T=b[S][L],q=typeof T,"function"===q?T.call(O):"string"==q&&"function"==typeof O[T]&&O[T]()}}var E=/[, ]+/;return b=b||{},k=k||[],"string"==typeof k&&(k=k.split(E)),function(){var q,O=this,L=0;if(null===O[k[0]])return!1;for(w("before",O);L<k.length;L++)q=k[L],O[q]&&("function"==typeof O[q].destroy&&O[q].destroy(),O[q]=null);return O.emit&&O.emit("destroy"),w("after",O),!0}}},{}],2:[function(g,v){"use strict";v.exports=function(){for(var b,k=this,w=0,E=arguments.length,S=Array(E);w<E;w++)S[w]=arguments[w];return"function"==typeof S[S.length-1]?(b=S.pop(),function(){for(var L=0,q=arguments.length,T=Array(q+1);L<q;L++)T[L+1]=arguments[L];return T[0]=function(N,P){return N?k.emit("error",N):void(T=void 0===P?T.slice(1):null===P?[]:P,k.emit.apply(k,S.concat(T)))},b.apply(k,T),!0}):function(){for(var L=0,q=arguments.length,T=Array(q);L<q;L++)T[L]=arguments[L];return k.emit.apply(k,S.concat(T))}}},{}],3:[function(g,v){"use strict";function _(){}function k(L,q,T){this.fn=L,this.context=q,this.once=T||!1}function b(L,q,T,C,N){if("function"!=typeof T)throw new TypeError("The listener must be a function");var P=new k(T,C||L,N),A=O?O+q:q;return L._events[A]?L._events[A].fn?L._events[A]=[L._events[A],P]:L._events[A].push(P):(L._events[A]=P,L._eventsCount++),L}function w(L,q){0==--L._eventsCount?L._events=new _:delete L._events[q]}function E(){this._events=new _,this._eventsCount=0}var S=Object.prototype.hasOwnProperty,O="~";Object.create&&(_.prototype=Object.create(null),!new _().__proto__&&(O=!1)),E.prototype.eventNames=function(){var T,C,q=[];if(0===this._eventsCount)return q;for(C in T=this._events)S.call(T,C)&&q.push(O?C.slice(1):C);return Object.getOwnPropertySymbols?q.concat(Object.getOwnPropertySymbols(T)):q},E.prototype.listeners=function(q){var T=O?O+q:q,C=this._events[T];if(!C)return[];if(C.fn)return[C.fn];for(var N=0,P=C.length,A=Array(P);N<P;N++)A[N]=C[N].fn;return A},E.prototype.listenerCount=function(q){var T=O?O+q:q,C=this._events[T];return C?C.fn?1:C.length:0},E.prototype.emit=function(q,T,C,N,P,A){var D=O?O+q:q;if(!this._events[D])return!1;var K,V,H=this._events[D],I=arguments.length;if(H.fn){switch(H.once&&this.removeListener(q,H.fn,void 0,!0),I){case 1:return H.fn.call(H.context),!0;case 2:return H.fn.call(H.context,T),!0;case 3:return H.fn.call(H.context,T,C),!0;case 4:return H.fn.call(H.context,T,C,N),!0;case 5:return H.fn.call(H.context,T,C,N,P),!0;case 6:return H.fn.call(H.context,T,C,N,P,A),!0;}for(V=1,K=Array(I-1);V<I;V++)K[V-1]=arguments[V];H.fn.apply(H.context,K)}else{var z,W=H.length;for(V=0;V<W;V++)switch(H[V].once&&this.removeListener(q,H[V].fn,void 0,!0),I){case 1:H[V].fn.call(H[V].context);break;case 2:H[V].fn.call(H[V].context,T);break;case 3:H[V].fn.call(H[V].context,T,C);break;case 4:H[V].fn.call(H[V].context,T,C,N);break;default:if(!K)for(z=1,K=Array(I-1);z<I;z++)K[z-1]=arguments[z];H[V].fn.apply(H[V].context,K);}}return!0},E.prototype.on=function(q,T,C){return b(this,q,T,C,!1)},E.prototype.once=function(q,T,C){return b(this,q,T,C,!0)},E.prototype.removeListener=function(q,T,C,N){var P=O?O+q:q;if(!this._events[P])return this;if(!T)return w(this,P),this;var A=this._events[P];if(A.fn)A.fn!==T||N&&!A.once||C&&A.context!==C||w(this,P);else{for(var D=0,H=[],I=A.length;D<I;D++)(A[D].fn!==T||N&&!A[D].once||C&&A[D].context!==C)&&H.push(A[D]);H.length?this._events[P]=1===H.length?H[0]:H:w(this,P)}return this},E.prototype.removeAllListeners=function(q){var T;return q?(T=O?O+q:q,this._events[T]&&w(this,T)):(this._events=new _,this._eventsCount=0),this},E.prototype.off=E.prototype.removeListener,E.prototype.addListener=E.prototype.on,E.prefixed=O,E.EventEmitter=E,"undefined"!=typeof v&&(v.exports=E)},{}],4:[function(g,v){v.exports="function"==typeof Object.create?function(k,b){k.super_=b,k.prototype=Object.create(b.prototype,{constructor:{value:k,enumerable:!1,writable:!0,configurable:!0}})}:function(k,b){k.super_=b;var w=function(){};w.prototype=b.prototype,k.prototype=new w,k.prototype.constructor=k}},{}],5:[function(g,v){"use strict";var _=new RegExp("^((?:\\d+)?\\.?\\d+) *("+["milliseconds?","msecs?","ms","seconds?","secs?","s","minutes?","mins?","m","hours?","hrs?","h","days?","d","weeks?","wks?","w","years?","yrs?","y"].join("|")+")?$","i"),k=1e3,b=60*k,w=60*b,E=24*w;v.exports=function(q){var C,N,T=typeof q;if("number"==T)return q;if("string"!=T||"0"===q||!q)return 0;if(+q)return+q;if(1e4<q.length||!(N=_.exec(q)))return 0;switch(C=parseFloat(N[1]),N[2].toLowerCase()){case"years":case"year":case"yrs":case"yr":case"y":return C*(365*E);case"weeks":case"week":case"wks":case"wk":case"w":return C*(7*E);case"days":case"day":case"d":return C*E;case"hours":case"hour":case"hrs":case"hr":case"h":return C*w;case"minutes":case"minute":case"mins":case"min":case"m":return C*b;case"seconds":case"second":case"secs":case"sec":case"s":return C*k;default:return C;}}},{}],6:[function(g,v){"use strict";v.exports=function(k){function b(){return w?E:(w=1,E=k.apply(this,arguments),k=null,E)}var E,w=0;return b.displayName=k.displayName||k.name||b.displayName||b.name,b}},{}],7:[function(g,v,x){"use strict";function _(E){return decodeURIComponent(E.replace(/\+/g," "))}var w=Object.prototype.hasOwnProperty;x.stringify=function(E,S){S=S||"";var O=[];for(var L in"string"!=typeof S&&(S="?"),E)w.call(E,L)&&O.push(encodeURIComponent(L)+"="+encodeURIComponent(E[L]));return O.length?S+O.join("&"):""},x.parse=function(E){for(var L,S=/([^=?&]+)=?([^&]*)/g,O={};L=S.exec(E);){var q=_(L[1]),T=_(L[2]);q in O||(O[q]=T)}return O}},{}],8:[function(g,v){"use strict";function _(L,q,T){return w(L in T?T[L]:L in q?q[L]:k[L])}function k(L){var q=this;return q instanceof k?void(L=L||{},q.attempt=null,q._fn=null,q["reconnect timeout"]=_("reconnect timeout",q,L),q.retries=_("retries",q,L),q.factor=_("factor",q,L),q.max=_("max",q,L),q.min=_("min",q,L),q.timers=new S(q)):new k(L)}var b=g("eventemitter3"),w=g("millisecond"),E=g("demolish"),S=g("tick-tock"),O=g("one-time");k.prototype=new b,k.prototype.constructor=k,k["reconnect timeout"]="30 seconds",k.max=Infinity,k.min="500 ms",k.retries=10,k.factor=2,k.prototype.reconnect=function(){var q=this;return q.backoff(function(C,N){return N.duration=+new Date-N.start,C?q.emit("reconnect failed",C,N):void q.emit("reconnected",N)},q.attempt)},k.prototype.backoff=function(q,T){var C=this;return(T=T||C.attempt||{},T.backoff)?C:(T["reconnect timeout"]=_("reconnect timeout",C,T),T.retries=_("retries",C,T),T.factor=_("factor",C,T),T.max=_("max",C,T),T.min=_("min",C,T),T.start=+T.start||+new Date,T.duration=+T.duration||0,T.attempt=+T.attempt||0,T.attempt===T.retries)?(q.call(C,new Error("Unable to recover"),T),C):(T.backoff=!0,T.attempt++,C.attempt=T,T.scheduled=1===T.attempt?T.min:Math.min(Math.round((Math.random()+1)*T.min*Math.pow(T.factor,T.attempt-1)),T.max),C.timers.setTimeout("reconnect",function(){T.duration=+new Date-T.start,T.backoff=!1,C.timers.clear("reconnect, timeout");var P=C._fn=O(function(D){return C.reset(),D?C.backoff(q,T):void q.call(C,void 0,T)});C.emit("reconnect",T,P),C.timers.setTimeout("timeout",function(){var D=new Error("Failed to reconnect in a timely manner");T.duration=+new Date-T.start,C.emit("reconnect timeout",D,T),P(D)},T["reconnect timeout"])},T.scheduled),C.emit("reconnect scheduled",T),C)},k.prototype.reconnecting=function(){return!!this.attempt},k.prototype.reconnected=function(q){return this._fn&&this._fn(q),this},k.prototype.reset=function(){return this._fn=this.attempt=null,this.timers.clear("reconnect, timeout"),this},k.prototype.destroy=E("timers attempt _fn"),v.exports=k},{demolish:1,eventemitter3:9,millisecond:5,"one-time":6,"tick-tock":11}],9:[function(g,v){"use strict";function _(w,E,S){this.fn=w,this.context=E,this.once=S||!1}function k(){}var b="function"!=typeof Object.create&&"~";k.prototype._events=void 0,k.prototype.listeners=function(E,S){var O=b?b+E:E,L=this._events&&this._events[O];if(S)return!!L;if(!L)return[];if(L.fn)return[L.fn];for(var q=0,T=L.length,C=Array(T);q<T;q++)C[q]=L[q].fn;return C},k.prototype.emit=function(E,S,O,L,q,T){var C=b?b+E:E;if(!this._events||!this._events[C])return!1;var A,D,N=this._events[C],P=arguments.length;if("function"==typeof N.fn){switch(N.once&&this.removeListener(E,N.fn,void 0,!0),P){case 1:return N.fn.call(N.context),!0;case 2:return N.fn.call(N.context,S),!0;case 3:return N.fn.call(N.context,S,O),!0;case 4:return N.fn.call(N.context,S,O,L),!0;case 5:return N.fn.call(N.context,S,O,L,q),!0;case 6:return N.fn.call(N.context,S,O,L,q,T),!0;}for(D=1,A=Array(P-1);D<P;D++)A[D-1]=arguments[D];N.fn.apply(N.context,A)}else{var I,H=N.length;for(D=0;D<H;D++)switch(N[D].once&&this.removeListener(E,N[D].fn,void 0,!0),P){case 1:N[D].fn.call(N[D].context);break;case 2:N[D].fn.call(N[D].context,S);break;case 3:N[D].fn.call(N[D].context,S,O);break;default:if(!A)for(I=1,A=Array(P-1);I<P;I++)A[I-1]=arguments[I];N[D].fn.apply(N[D].context,A);}}return!0},k.prototype.on=function(E,S,O){var L=new _(S,O||this),q=b?b+E:E;return this._events||(this._events=b?{}:Object.create(null)),this._events[q]?this._events[q].fn?this._events[q]=[this._events[q],L]:this._events[q].push(L):this._events[q]=L,this},k.prototype.once=function(E,S,O){var L=new _(S,O||this,!0),q=b?b+E:E;return this._events||(this._events=b?{}:Object.create(null)),this._events[q]?this._events[q].fn?this._events[q]=[this._events[q],L]:this._events[q].push(L):this._events[q]=L,this},k.prototype.removeListener=function(E,S,O,L){var q=b?b+E:E;if(!this._events||!this._events[q])return this;var T=this._events[q],C=[];if(S)if(T.fn)(T.fn!==S||L&&!T.once||O&&T.context!==O)&&C.push(T);else for(var N=0,P=T.length;N<P;N++)(T[N].fn!==S||L&&!T[N].once||O&&T[N].context!==O)&&C.push(T[N]);return C.length?this._events[q]=1===C.length?C[0]:C:delete this._events[q],this},k.prototype.removeAllListeners=function(E){return this._events?(E?delete this._events[b?b+E:E]:this._events=b?{}:Object.create(null),this):this},k.prototype.off=k.prototype.removeListener,k.prototype.addListener=k.prototype.on,k.prototype.setMaxListeners=function(){return this},k.prefixed=b,"undefined"!=typeof v&&(v.exports=k)},{}],10:[function(g,v){"use strict";v.exports=function(k,b){return(b=b.split(":")[0],k=+k,!!k)&&("http"===b||"ws"===b?80!==k:"https"===b||"wss"===b?443!==k:"ftp"===b?21!==k:"gopher"===b?70!==k:"file"!=b&&0!==k)}},{}],11:[function(g,v){"use strict";function _(L,q,T,C){this.start=+new Date,this.duration=T,this.clear=q,this.timer=L,this.fns=[C]}function k(L){clearTimeout(L)}function b(L){clearInterval(L)}function w(L){clearImmediate(L)}function E(L){return this instanceof E?void(this.timers={},this.context=L||this):new E(L)}var S=Object.prototype.hasOwnProperty,O=g("millisecond");_.prototype.remaining=function(){return this.duration-this.taken()},_.prototype.taken=function(){return+new Date-this.start},E.prototype.tock=function(q,T){var C=this;return function(){if(q in C.timers){var P=C.timers[q],A=P.fns.slice(),D=A.length,H=0;for(T?C.clear(q):C.start=+new Date;H<D;H++)A[H].call(C.context)}}},E.prototype.setTimeout=function(q,T,C){var P,N=this;return N.timers[q]?(N.timers[q].fns.push(T),N):(P=O(C),N.timers[q]=new _(setTimeout(N.tock(q,!0),O(C)),k,P,T),N)},E.prototype.setInterval=function(q,T,C){var P,N=this;return N.timers[q]?(N.timers[q].fns.push(T),N):(P=O(C),N.timers[q]=new _(setInterval(N.tock(q),O(C)),b,P,T),N)},E.prototype.setImmediate=function(q,T){var C=this;return"function"==typeof setImmediate?C.timers[q]?(C.timers[q].fns.push(T),C):(C.timers[q]=new _(setImmediate(C.tock(q,!0)),w,0,T),C):C.setTimeout(q,T,0)},E.prototype.active=function(q){return q in this.timers},E.prototype.clear=function(){var C,N,P,q=arguments.length?arguments:[],T=this;if(1===q.length&&"string"==typeof q[0]&&(q=q[0].split(/[, ]+/)),!q.length)for(C in T.timers)S.call(T.timers,C)&&q.push(C);for(N=0,P=q.length;N<P;N++)C=T.timers[q[N]],C&&(C.clear(C.timer),C.fns=C.timer=C.clear=null,delete T.timers[q[N]]);return T},E.prototype.adjust=function(q,T){var C,N=this,P=O(T),A=N.timers[q];return A?(C=A.clear===b,A.clear(A.timer),A.start=+new Date,A.duration=P,A.timer=(C?setInterval:setTimeout)(N.tock(q,!C),P),N):N},E.prototype.end=E.prototype.destroy=function(){return!!this.context&&(this.clear(),this.context=this.timers=null,!0)},E.Timer=_,v.exports=E},{millisecond:5}],12:[function(g,v){(function(_){"use strict";function k(A){A=A||_.location||{};var I,D={},H=typeof A;if("blob:"===A.protocol)D=new E(unescape(A.pathname),{});else if("string"==H)for(I in D=new E(A,{}),P)delete D[I];else if("object"==H){for(I in A)I in P||(D[I]=A[I]);void 0===D.slashes&&(D.slashes=C.test(A.href))}return D}function b(A){var D=T.exec(A);return{protocol:D[1]?D[1].toLowerCase():"",slashes:!!D[2],rest:D[3]}}function w(A,D){for(var H=(D||"/").split("/").slice(0,-1).concat(A.split("/")),I=H.length,K=H[I-1],V=!1,W=0;I--;)"."===H[I]?H.splice(I,1):".."===H[I]?(H.splice(I,1),W++):W&&(0===I&&(V=!0),H.splice(I,1),W--);return V&&H.unshift(""),("."===K||".."===K)&&H.push(""),H.join("/")}function E(A,D,H){if(!(this instanceof E))return new E(A,D,H);var I,K,V,W,z,R,B=N.slice(),M=typeof D,U=this,F=0;for("object"!=M&&"string"!=M&&(H=D,D=null),H&&"function"!=typeof H&&(H=q.parse),D=k(D),K=b(A||""),I=!K.protocol&&!K.slashes,U.slashes=K.slashes||I&&D.slashes,U.protocol=K.protocol||D.protocol||"",A=K.rest,K.slashes||(B[2]=[/(.*)/,"pathname"]);F<B.length;F++)W=B[F],V=W[0],R=W[1],V==V?"string"==typeof V?~(z=A.indexOf(V))&&("number"==typeof W[2]?(U[R]=A.slice(0,z),A=A.slice(z+W[2])):(U[R]=A.slice(z),A=A.slice(0,z))):(z=V.exec(A))&&(U[R]=z[1],A=A.slice(0,z.index)):U[R]=A,U[R]=U[R]||(I&&W[3]?D[R]||"":""),W[4]&&(U[R]=U[R].toLowerCase());H&&(U.query=H(U.query)),I&&D.slashes&&"/"!==U.pathname.charAt(0)&&(""!==U.pathname||""!==D.pathname)&&(U.pathname=w(U.pathname,D.pathname)),L(U.port,U.protocol)||(U.host=U.hostname,U.port=""),U.username=U.password="",U.auth&&(W=U.auth.split(":"),U.username=W[0]||"",U.password=W[1]||""),U.origin=U.protocol&&U.host&&"file:"!==U.protocol?U.protocol+"//"+U.host:"null",U.href=U.toString()}var L=g("requires-port"),q=g("querystringify"),T=/^([a-z][a-z0-9.+-]*:)?(\/\/)?([\S\s]*)/i,C=/^[A-Za-z][A-Za-z0-9+-.]*:\/\//,N=[["#","hash"],["?","query"],["/","pathname"],["@","auth",1],[NaN,"host",void 0,1,1],[/:(\d+)$/,"port",void 0,1],[NaN,"hostname",void 0,1,1]],P={hash:1,query:1};E.prototype={set:function(A,D,H){var I=this;switch(A){case"query":"string"==typeof D&&D.length&&(D=(H||q.parse)(D)),I[A]=D;break;case"port":I[A]=D,L(D,I.protocol)?D&&(I.host=I.hostname+":"+D):(I.host=I.hostname,I[A]="");break;case"hostname":I[A]=D,I.port&&(D+=":"+I.port),I.host=D;break;case"host":I[A]=D,/:\d+$/.test(D)?(D=D.split(":"),I.port=D.pop(),I.hostname=D.join(":")):(I.hostname=D,I.port="");break;case"protocol":I.protocol=D.toLowerCase(),I.slashes=!H;break;case"pathname":case"hash":if(D){var K="pathname"===A?"/":"#";I[A]=D.charAt(0)===K?D:K+D}else I[A]=D;break;default:I[A]=D;}for(var W,V=0;V<N.length;V++)W=N[V],W[4]&&(I[W[1]]=I[W[1]].toLowerCase());return I.origin=I.protocol&&I.host&&"file:"!==I.protocol?I.protocol+"//"+I.host:"null",I.href=I.toString(),I},toString:function(A){A&&"function"==typeof A||(A=q.stringify);var D,H=this,I=H.protocol;I&&":"!==I.charAt(I.length-1)&&(I+=":");var K=I+(H.slashes?"//":"");return H.username&&(K+=H.username,H.password&&(K+=":"+H.password),K+="@"),K+=H.host+H.pathname,D="object"==typeof H.query?A(H.query):H.query,D&&(K+="?"===D.charAt(0)?D:"?"+D),H.hash&&(K+=H.hash),K}},E.extractProtocol=b,E.location=k,E.qs=q,v.exports=E}).call(this,"undefined"==typeof global?"undefined"==typeof self?"undefined"==typeof window?{}:window:self:global)},{querystringify:7,"requires-port":10}],13:[function(g,v){"use strict";function _(T){var C="";do C=w[T%E]+C,T=Math.floor(T/E);while(0<T);return C}function b(){var T=_(+new Date);return T===q?T+"."+_(O++):(O=0,q=T)}for(var q,w="0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_".split(""),E=64,S={},O=0,L=0;L<E;L++)S[w[L]]=L;b.encode=_,b.decode=function(T){var C=0;for(L=0;L<T.length;L++)C=C*E+S[T.charAt(L)];return C},v.exports=b},{}],14:[function(g,v){"use strict";function _(H,I){if(!(H instanceof k)){var K=new Error("Primus#"+I+"'s context should called with a Primus instance");if("function"!=typeof H.listeners||!H.listeners("error").length)throw K;H.emit("error",K)}}function k(H,I){if(!(this instanceof k))return new k(H,I);if(k.Stream.call(this),"function"!=typeof this.client)return this.critical(new Error("The client library has not been compiled correctly, see https://github.com/primus/primus#client-library for more details"));if("object"==typeof H?(I=H,H=I.url||I.uri||N):I=I||{},"ping"in I||"pong"in I)return this.critical(new Error("The `ping` and `pong` options have been removed"));var K=this;I.queueSize="queueSize"in I?I.queueSize:Infinity,I.timeout="timeout"in I?I.timeout:1e4,I.reconnect="reconnect"in I?I.reconnect:{},I.pingTimeout="pingTimeout"in I?I.pingTimeout:45000,I.strategy="strategy"in I?I.strategy:[],I.transport="transport"in I?I.transport:{},K.buffer=[],K.writable=!0,K.readable=!0,K.url=K.parse(H||N),K.readyState=k.CLOSED,K.options=I,K.timers=new w(this),K.socket=null,K.disconnect=!1,K.transport=I.transport,K.transformers={outgoing:[],incoming:[]},K.recovery=new E(I.reconnect),"string"==typeof I.strategy&&(I.strategy=I.strategy.split(/\s?,\s?/g)),!1===I.strategy?I.strategy=[]:!I.strategy.length&&(I.strategy.push("disconnect","online"),!this.authorization&&I.strategy.push("timeout")),I.strategy=I.strategy.join(",").toLowerCase(),"websockets"in I&&(K.AVOID_WEBSOCKETS=!I.websockets),"network"in I&&(K.NETWORK_EVENTS=I.network),I.manual||K.timers.setTimeout("open",function(){K.timers.clear("open"),K.open()},0),K.initialise(I)}var N,b=g("eventemitter3"),w=g("tick-tock"),E=g("recovery"),S=g("querystringify"),O=g("inherits"),L=g("demolish"),q=g("yeast"),T=/\u2028/g,C=/\u2029/g;try{N=location.origin?location.origin:location.protocol+"//"+location.host}catch(H){N="http://127.0.0.1"}k.requires=k.require=function(I){return"function"==typeof g?"function"==typeof m&&m.amd?void 0:g(I):void 0};try{k.Stream=k.requires("stream")}catch(H){}k.Stream||(k.Stream=b),O(k,k.Stream),k.OPENING=1,k.CLOSED=2,k.OPEN=3,k.prototype.AVOID_WEBSOCKETS=!1,k.prototype.NETWORK_EVENTS=!1,k.prototype.online=!0;try{(k.prototype.NETWORK_EVENTS="onLine"in navigator&&(window.addEventListener||document.body.attachEvent))&&!navigator.onLine&&(k.prototype.online=!1)}catch(H){}if(k.prototype.ark={},k.prototype.emits=g("emits"),k.prototype.plugin=function(I){if(_(this,"plugin"),I)return this.ark[I];var K={};for(I in this.ark)K[I]=this.ark[I];return K},k.prototype.reserved=function(I){return /^(incoming|outgoing)::/.test(I)||I in this.reserved.events},k.prototype.reserved.events={"reconnect scheduled":1,"reconnect timeout":1,readyStateChange:1,"reconnect failed":1,reconnected:1,reconnect:1,offline:1,timeout:1,destroy:1,online:1,error:1,close:1,open:1,data:1,end:1},k.prototype.initialise=function(I){var K=this;for(var V in K.recovery.on("reconnected",K.emits("reconnected")).on("reconnect failed",K.emits("reconnect failed",function(z){K.emit("end"),z()})).on("reconnect timeout",K.emits("reconnect timeout")).on("reconnect scheduled",K.emits("reconnect scheduled")).on("reconnect",K.emits("reconnect",function(z){K.emit("outgoing::reconnect"),z()})),K.on("outgoing::open",function(){var z=K.readyState;K.readyState=k.OPENING,z!==K.readyState&&K.emit("readyStateChange","opening")}),K.on("incoming::open",function(){var z=K.readyState;if(K.recovery.reconnecting()&&K.recovery.reconnected(),K.writable=!0,K.readable=!0,K.online||(K.online=!0,K.emit("online")),K.readyState=k.OPEN,z!==K.readyState&&K.emit("readyStateChange","open"),K.heartbeat(),K.buffer.length){var R=K.buffer.slice(),B=R.length,M=0;for(K.buffer.length=0;M<B;M++)K._write(R[M])}K.emit("open")}),K.on("incoming::ping",function(z){K.online=!0,K.heartbeat(),K.emit("outgoing::pong",z),K._write("primus::pong::"+z)}),K.on("incoming::error",function(z){var R=K.timers.active("connect"),B=z;if("string"==typeof z)B=new Error(z);else if(!(z instanceof Error)&&"object"==typeof z)for(var M in B=new Error(z.message||z.reason),z)Object.prototype.hasOwnProperty.call(z,M)&&(B[M]=z[M]);return K.recovery.reconnecting()?K.recovery.reconnected(B):void(K.listeners("error").length&&K.emit("error",B),R&&(~K.options.strategy.indexOf("timeout")?K.recovery.reconnect():K.end()))}),K.on("incoming::data",function(z){K.decoder(z,function(B,M){return B?K.listeners("error").length&&K.emit("error",B):void(K.protocol(M)||K.transforms(K,K,"incoming",M,z))})}),K.on("incoming::end",function(){var z=K.readyState;return K.disconnect?(K.disconnect=!1,K.end()):(K.readyState=k.CLOSED,z!==K.readyState&&K.emit("readyStateChange","end"),K.timers.active("connect")&&K.end(),z!==k.OPEN)?!!K.recovery.reconnecting()&&K.recovery.reconnect():(this.writable=!1,this.readable=!1,this.timers.clear(),K.emit("close"),~K.options.strategy.indexOf("disconnect")?K.recovery.reconnect():void(K.emit("outgoing::end"),K.emit("end")))}),K.client(),K.ark)K.ark[V].call(K,K,I);return K.NETWORK_EVENTS?(K.offlineHandler=function(){K.online&&(K.online=!1,K.emit("offline"),K.end(),K.recovery.reset())},K.onlineHandler=function(){K.online||(K.online=!0,K.emit("online"),~K.options.strategy.indexOf("online")&&K.recovery.reconnect())},window.addEventListener?(window.addEventListener("offline",K.offlineHandler,!1),window.addEventListener("online",K.onlineHandler,!1)):document.body.attachEvent&&(document.body.attachEvent("onoffline",K.offlineHandler),document.body.attachEvent("ononline",K.onlineHandler)),K):K},k.prototype.protocol=function(I){if("string"!=typeof I||0!==I.indexOf("primus::"))return!1;var K=I.indexOf(":",8),V=I.slice(K+2);switch(I.slice(8,K)){case"ping":this.emit("incoming::ping",+V);break;case"server":"close"===V&&(this.disconnect=!0);break;case"id":this.emit("incoming::id",V);break;default:return!1;}return!0},k.prototype.transforms=function(I,K,V,W,z){var R={data:W},B=I.transformers[V];return function M(U,F){var G=B[U++];return G?1===G.length?!1===G.call(K,R)?void 0:M(U,F):void G.call(K,R,function(Q,X){return Q?K.emit("error",Q):void(!1===X||M(U,F))}):F()}(0,function(){return"incoming"===V?K.emit("data",R.data,z):void K._write(R.data)}),this},k.prototype.id=function(I){return this.socket&&this.socket.id?I(this.socket.id):(this._write("primus::id::"),this.once("incoming::id",I))},k.prototype.open=function(){return _(this,"open"),!this.recovery.reconnecting()&&this.options.timeout&&this.timeout(),this.emit("outgoing::open"),this},k.prototype.write=function(I){return _(this,"write"),this.transforms(this,this,"outgoing",I),!0},k.prototype._write=function(I){var K=this;return k.OPEN===K.readyState?(K.encoder(I,function(W,z){return W?K.listeners("error").length&&K.emit("error",W):void("string"==typeof z&&(~z.indexOf("\u2028")&&(z=z.replace(T,"\\u2028")),~z.indexOf("\u2029")&&(z=z.replace(C,"\\u2029"))),K.emit("outgoing::data",z))}),!0):(this.buffer.length===this.options.queueSize&&this.buffer.splice(0,1),this.buffer.push(I),!1)},k.prototype.heartbeat=function(){return this.options.pingTimeout?(this.timers.clear("heartbeat"),this.timers.setTimeout("heartbeat",function(){this.online&&(this.online=!1,this.emit("offline"),this.emit("incoming::end"))},this.options.pingTimeout),this):this},k.prototype.timeout=function(){function I(){K.removeListener("error",I).removeListener("open",I).removeListener("end",I).timers.clear("connect")}var K=this;return K.timers.setTimeout("connect",function(){I(),K.readyState===k.OPEN||K.recovery.reconnecting()||(K.emit("timeout"),~K.options.strategy.indexOf("timeout")?K.recovery.reconnect():K.end())},K.options.timeout),K.on("error",I).on("open",I).on("end",I)},k.prototype.end=function(I){if(_(this,"end"),this.readyState===k.CLOSED&&!this.timers.active("connect")&&!this.timers.active("open"))return this.recovery.reconnecting()&&(this.recovery.reset(),this.emit("end")),this;void 0!==I&&this.write(I),this.writable=!1,this.readable=!1;var K=this.readyState;return this.readyState=k.CLOSED,K!==this.readyState&&this.emit("readyStateChange","end"),this.timers.clear(),this.emit("outgoing::end"),this.emit("close"),this.emit("end"),this},k.prototype.destroy=L("url timers options recovery socket transport transformers",{before:"end",after:["removeAllListeners",function(){this.NETWORK_EVENTS&&(window.addEventListener?(window.removeEventListener("offline",this.offlineHandler),window.removeEventListener("online",this.onlineHandler)):document.body.attachEvent&&(document.body.detachEvent("onoffline",this.offlineHandler),document.body.detachEvent("ononline",this.onlineHandler)))}]}),k.prototype.clone=function(I){return this.merge({},I)},k.prototype.merge=function(I){for(var V,W,K=1;K<arguments.length;K++)for(V in W=arguments[K],W)Object.prototype.hasOwnProperty.call(W,V)&&(I[V]=W[V]);return I},k.prototype.parse=g("url-parse"),k.prototype.querystring=S.parse,k.prototype.querystringify=S.stringify,k.prototype.uri=function(I){var K=this.url,V=[],W=!1;I.query&&(W=!0),I=I||{},I.protocol="protocol"in I?I.protocol:"http:",I.query=K.query&&W&&K.query.slice(1),I.secure="secure"in I?I.secure:"https:"===K.protocol||"wss:"===K.protocol,I.auth="auth"in I?I.auth:K.auth,I.pathname="pathname"in I?I.pathname:this.pathname,I.port="port"in I?+I.port:+K.port||(I.secure?443:80);var z=this.querystring(I.query||"");return z._primuscb=q(),I.query=this.querystringify(z),this.emit("outgoing::url",I),V.push(I.secure?I.protocol.replace(":","s:"):I.protocol,""),V.push(I.auth?I.auth+"@"+K.host:K.host),I.pathname&&V.push(I.pathname.slice(1)),W?V[V.length-1]+="?"+I.query:delete I.query,I.object?I:V.join("/")},k.prototype.transform=function(I,K){return(_(this,"transform"),!(I in this.transformers))?this.critical(new Error("Invalid transformer type")):(this.transformers[I].push(K),this)},k.prototype.critical=function(I){if(this.emit("error",I))return this;throw I},k.connect=function(I,K){return new k(I,K)},k.EventEmitter=b,k.prototype.client=function(){var K,I=this,V=function(){if("undefined"!=typeof WebSocket)return WebSocket;if("undefined"!=typeof MozWebSocket)return MozWebSocket;try{return k.requires("ws")}catch(z){}}();return V?void(I.on("outgoing::open",function(){I.emit("outgoing::end");try{var z={protocol:"ws+unix:"===I.url.protocol?"ws+unix:":"ws:",query:!0};3===V.length?("ws+unix:"===z.protocol&&(z.pathname=I.url.pathname+":"+I.pathname),I.socket=K=new V(I.uri(z),[],I.transport)):(I.socket=K=new V(I.uri(z)),K.binaryType="arraybuffer")}catch(R){return I.emit("error",R)}K.onopen=I.emits("incoming::open"),K.onerror=I.emits("incoming::error"),K.onclose=I.emits("incoming::end"),K.onmessage=I.emits("incoming::data",function(B,M){B(void 0,M.data)})}),I.on("outgoing::data",function(z){if(K&&K.readyState===V.OPEN)try{K.send(z)}catch(R){I.emit("incoming::error",R)}}),I.on("outgoing::reconnect",function(){I.emit("outgoing::open")}),I.on("outgoing::end",function(){K&&(K.onerror=K.onopen=K.onclose=K.onmessage=function(){},K.close(),K=null)})):I.critical(new Error("Missing required `ws` module. Please run `npm install --save ws`"))},k.prototype.authorization=!1,k.prototype.pathname="/tg",k.prototype.encoder=function(I,K){var V;try{I=JSON.stringify(I)}catch(W){V=W}K(V,I)},k.prototype.decoder=function(I,K){var V;if("string"!=typeof I)return K(V,I);try{I=JSON.parse(I)}catch(W){V=W}K(V,I)},k.prototype.version="7.2.2","undefined"!=typeof document&&"undefined"!=typeof navigator){document.addEventListener&&document.addEventListener("keydown",function(I){27===I.keyCode&&I.preventDefault&&I.preventDefault()},!1);var P=(navigator.userAgent||"").toLowerCase(),A=P.match(/.+(?:rv|it|ra|ie)[/: ](\d+)\.(\d+)(?:\.(\d+))?/)||[],D=+[A[1],A[2]].join(".");!~P.indexOf("chrome")&&~P.indexOf("safari")&&534.54>D&&(k.prototype.AVOID_WEBSOCKETS=!0)}v.exports=k},{demolish:1,emits:2,eventemitter3:3,inherits:4,querystringify:7,recovery:8,"tick-tock":11,"url-parse":12,yeast:13}]},{},[14])(14);return h},[]);