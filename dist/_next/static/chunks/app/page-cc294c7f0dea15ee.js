(self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([[931],{2286:function(e,t,r){Promise.resolve().then(r.bind(r,6961))},6961:function(e,t,r){"use strict";r.r(t),r.d(t,{default:function(){return l}});var i=r(7437);let n=new(r(2544)).KU({auth:"secret_VVa8W5mp508KD3OfXpH0HkRV2GWgOBYkIxdGA4nqFqJ"});class s{static async ParseNotion(){let e=[];return(await n.blocks.children.list({block_id:"74679b0c46364ed7bda1ee0f20d640f5",page_size:50})).results.forEach(t=>{if(console.log(t),"paragraph"===t.type){var r;let n=a(t.created_time);e.push((0,i.jsxs)("div",{children:[(0,i.jsx)("p",{children:(0,i.jsx)("b",{children:n})}),(0,i.jsx)("p",{children:null===(r=t.paragraph.rich_text[0])||void 0===r?void 0:r.plain_text})]}))}}),e.sort((e,t)=>{let r=e.props.children[0].props.children;return new Date(t.props.children[0].props.children).getTime()-new Date(r).getTime()}),e.reverse(),this.lastUpdated=e[0].props.children[0].props.children,console.log(e),e}constructor(){this.lastUpdated="?"}}let a=e=>new Date(e).toLocaleString("en-GB",{year:"numeric",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});function l(){let e=s.ParseNotion();return(0,i.jsx)("main",{children:(0,i.jsxs)("div",{className:"column",children:[(0,i.jsx)("h1",{children:"m5b6"}),(0,i.jsxs)("small",{children:["last updated: ",s.lastUpdated]}),(0,i.jsxs)("div",{className:"links",children:[(0,i.jsx)("a",{target:"_blank",href:"https://twitter.com/matiasberrioss",children:"twitter"}),"|",(0,i.jsx)("a",{target:"_blank",href:"https://linkedin.com/in/matiasberrios",children:"linkedin"}),"|",(0,i.jsx)("a",{target:"_blank",href:"https://github.com/m5b6",children:"github"})]}),(0,i.jsxs)("p",{children:["engineer & researcher from Chile, with an interest in healthcare applied AI.",(0,i.jsx)("br",{}),"these are my notes on various topics, related and unrelated to my work."]}),e]})})}}},function(e){e.O(0,[544,971,23,744],function(){return e(e.s=2286)}),_N_E=e.O()}]);