/**
 * Yorkshire sentada, curiosa, procurando a página (desenho próprio da MEL, como a Mel). Traços da
 * raça: orelhas pequenas em "V", pelo longo e liso (mechas douradas dos lados do rosto, bigode
 * caído, topete preso no laço) e o manto azul-aço caindo até o chão, com só as patinhas à mostra.
 * As partes animadas ficam em grupos com classe (not-found.css): rabo abanando, cabeça inclinando,
 * orelha mexendo, olhos piscando, nariz farejando, respiração, "?" no ar e patinhas no chão.
 */
export function LostYorkie() {
  const tan = "#d6a15a";
  const tanDark = "#a26c35";
  const tanLight = "#ecca8e";
  const steel = "#5b6880";
  const steelLight = "#8592a8";
  const ink = "#1b1410";
  const strand = { fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 400 420" className="nf-yorkie size-full overflow-visible" role="presentation">
      {/* Sombra e patinhas no chão */}
      <ellipse cx="200" cy="400" rx="120" ry="11" fill="black" opacity="0.2" />
      {[
        [54, 406, -18],
        [88, 390, -10],
        [330, 406, 14],
        [356, 388, 22],
      ].map(([x, y, r], i) => (
        <g key={i} className="nf-paw" style={{ animationDelay: `${i * 0.45}s` }} transform={`translate(${x} ${y}) rotate(${r})`}>
          <ellipse cx="0" cy="4" rx="7" ry="6" fill="var(--mel-primary)" />
          <circle cx="-7" cy="-5" r="2.8" fill="var(--mel-primary)" />
          <circle cx="-2.4" cy="-8.5" r="2.8" fill="var(--mel-primary)" />
          <circle cx="2.4" cy="-8.5" r="2.8" fill="var(--mel-primary)" />
          <circle cx="7" cy="-5" r="2.8" fill="var(--mel-primary)" />
        </g>
      ))}

      {/* Rabo com pelo comprido (atrás do corpo) */}
      <g className="nf-tail">
        <path d="M258 304 C288 290 304 258 298 226 C314 240 322 270 310 294 C302 308 288 316 272 320 Z" fill={steel} />
        <path d="M298 226 C306 216 320 220 322 230 C318 244 310 250 304 248 Z" fill={tan} />
        <path d="M282 300 C296 288 304 270 304 252" stroke={steelLight} strokeWidth="2.5" opacity="0.7" {...strand} />
      </g>

      {/* Corpo: manto azul-aço até o chão, peito dourado comprido e patinhas */}
      <g className="nf-body">
        <path
          d="M150 226 C120 260 106 322 102 384 Q114 396 126 388 Q138 398 150 388 Q162 398 174 390 L226 390 Q238 398 250 388 Q262 398 274 388 Q286 396 298 384 C294 322 280 260 250 226 Z"
          fill={steel}
        />
        <path
          d="M140 262 C130 300 124 340 122 378 M156 280 C150 316 148 350 150 382 M244 280 C250 316 252 350 250 382 M260 262 C270 300 276 340 278 378"
          stroke={steelLight}
          strokeWidth="2.6"
          opacity="0.65"
          {...strand}
        />
        <path d="M168 232 C164 292 170 340 178 374 Q200 386 222 374 C230 340 236 292 232 232 C220 250 180 250 168 232 Z" fill={tanLight} />
        <path d="M184 262 C182 300 186 336 190 366 M200 258 V372 M216 262 C218 300 214 336 210 366" stroke={tan} strokeWidth="2.4" opacity="0.8" {...strand} />
        <ellipse cx="183" cy="391" rx="18" ry="10" fill={tan} />
        <ellipse cx="217" cy="391" rx="18" ry="10" fill={tan} />
        <path d="M176 388 v5 M183 387 v6 M190 388 v5 M210 388 v5 M217 387 v6 M224 388 v5" stroke={tanDark} strokeWidth="2" strokeLinecap="round" />
      </g>

      {/* Cabeça (inclina) */}
      <g className="nf-head">
        {/* Orelhas pequenas em "V", com franjinha na ponta */}
        <path d="M152 130 L134 66 C152 74 168 98 174 118 Z" fill={tan} />
        <path d="M154 120 L142 80 C152 88 162 102 166 116 Z" fill={tanDark} />
        <path d="M134 66 L130 58 M134 66 L126 64 M136 70 L128 72" stroke={tan} strokeWidth="3" {...strand} />
        <g className="nf-ear">
          <path d="M248 130 L266 66 C248 74 232 98 226 118 Z" fill={tan} />
          <path d="M246 120 L258 80 C248 88 238 102 234 116 Z" fill={tanDark} />
          <path d="M266 66 L270 58 M266 66 L274 64 M264 70 L272 72" stroke={tan} strokeWidth="3" {...strand} />
        </g>

        {/* Mechas longas dos lados do rosto, caindo sobre o manto */}
        <path d="M140 158 C124 200 128 252 150 296 C156 266 160 232 170 206 Z" fill={tan} />
        <path d="M260 158 C276 200 272 252 250 296 C244 266 240 232 230 206 Z" fill={tan} />
        <path d="M144 200 C140 232 142 260 150 284 M256 200 C260 232 258 260 250 284" stroke={tanDark} strokeWidth="2.2" opacity="0.55" {...strand} />

        {/* Rosto */}
        <path d="M200 102 C246 102 270 134 268 170 C266 202 244 226 200 228 C156 226 134 202 132 170 C130 134 154 102 200 102 Z" fill={tan} />
        <path d="M200 104 V128" stroke={tanDark} strokeWidth="2" opacity="0.5" strokeLinecap="round" />

        {/* Topete preso no laço */}
        <path d="M186 98 C180 80 184 66 192 60 C192 74 196 86 200 94 C204 86 208 74 208 60 C216 66 220 80 214 98 Z" fill={tanLight} />
        <g>
          <path d="M200 100 L172 84 L176 116 Z" fill="var(--mel-primary)" stroke="var(--mel-primary-hover)" strokeWidth="2" strokeLinejoin="round" />
          <path d="M200 100 L228 84 L224 116 Z" fill="var(--mel-primary)" stroke="var(--mel-primary-hover)" strokeWidth="2" strokeLinejoin="round" />
          <circle cx="200" cy="100" r="7.5" fill="var(--mel-primary-hover)" />
        </g>

        {/* Sobrancelhas: a esquerda erguida (curiosidade) */}
        <path d="M164 144 Q175 134 188 142" stroke={tanDark} strokeWidth="4" strokeLinecap="round" fill="none" />
        <path d="M212 146 Q224 142 236 148" stroke={tanDark} strokeWidth="4" strokeLinecap="round" fill="none" />
        {/* Olhos (piscam) */}
        <g className="nf-eyes">
          <circle cx="177" cy="163" r="10" fill={ink} />
          <circle cx="223" cy="163" r="10" fill={ink} />
          <circle cx="180.5" cy="159" r="3.4" fill="white" />
          <circle cx="226.5" cy="159" r="3.4" fill="white" />
        </g>

        {/* Bigode longo caindo do focinho */}
        <path d="M176 196 C172 230 182 262 200 280 C218 262 228 230 224 196 C212 212 188 212 176 196 Z" fill={tanLight} />
        <path d="M188 214 C186 236 190 254 196 268 M212 214 C214 236 210 254 204 268" stroke={tan} strokeWidth="2.2" opacity="0.8" {...strand} />
        <ellipse cx="200" cy="193" rx="24" ry="17" fill={tanLight} />
        <g className="nf-nose">
          <path d="M188 183 C188 175 212 175 212 183 C212 191 204 196 200 196 C196 196 188 191 188 183 Z" fill={ink} />
          <ellipse cx="195" cy="180" rx="4" ry="2" fill="white" opacity="0.5" />
        </g>
        <path d="M200 196 V203 M200 203 C195 209 188 208 185 204 M200 203 C205 209 212 208 215 204" stroke="#5a3b20" strokeWidth="2.6" strokeLinecap="round" fill="none" />
        <path d="M196 206 C196 215 204 215 204 206 Z" fill="#e8818a" />
      </g>

      {/* "?" no ar */}
      <g className="nf-q">
        <text x="300" y="104" fontSize="70" fontWeight="900" fill="var(--mel-primary)" fontFamily="inherit">
          ?
        </text>
      </g>
    </svg>
  );
}
