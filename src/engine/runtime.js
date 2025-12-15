// IR3 runtime: condition as AST, effect as list of statements (mutations).
// This runtime is tolerant to common AST shapes from build output.

function isNil(v){ return v === null || v === undefined; }

function toNumber(x){
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

function getVar(state, name){
  return state[name];
}

function evalExpr(node, state){
  if (isNil(node)) return 0;

  // Allow literals
  if (typeof node === 'number') return node;
  if (typeof node === 'string'){
    // try parse number; else treat as var
    if (/^-?\d+(\.\d+)?$/.test(node.trim())) return Number(node);
    return toNumber(getVar(state, node));
  }

  // Support {type:'const', value:...} or {t:'num', v:...}
  const t = node.type || node.t || node.kind || node.op;
  const v = node.value ?? node.v;

  if (t === 'const' || t === 'num' || t === 'number') return toNumber(v);
  if (t === 'var' || t === 'id' || t === 'name') return toNumber(getVar(state, v));
  if (t === 'neg' || t === 'unary-' || (t === '-' && node.args?.length === 1)) return -toNumber(evalExpr(node.expr ?? node.arg ?? node.args?.[0], state));

  const a = node.left ?? node.a ?? node.lhs ?? (node.args ? node.args[0] : undefined);
  const b = node.right ?? node.b ?? node.rhs ?? (node.args ? node.args[1] : undefined);

  switch (t){
    case '+': case 'add': return toNumber(evalExpr(a, state)) + toNumber(evalExpr(b, state));
    case '-': case 'sub': return toNumber(evalExpr(a, state)) - toNumber(evalExpr(b, state));
    case '*': case 'mul': return toNumber(evalExpr(a, state)) * toNumber(evalExpr(b, state));
    case '/': case 'div': {
      const denom = toNumber(evalExpr(b, state));
      return denom === 0 ? 0 : toNumber(evalExpr(a, state)) / denom;
    }
    default:
      // unknown -> 0
      return 0;
  }
}

function evalCondition(ast, state){
  if (isNil(ast)) return true; // empty condition = always true
  if (typeof ast === 'boolean') return ast;

  const t = ast.type || ast.t || ast.kind || ast.op;
  if (t === 'true') return true;
  if (t === 'false') return false;

  // NOT
  if (t === 'not' || t === '!'){
    return !evalCondition(ast.expr ?? ast.arg ?? ast.args?.[0], state);
  }

  // AND / OR / XOR
  const args = ast.args || ast.nodes || ast.children;
  if (t === 'and' || t === '&&'){
    return (args || []).every(n => evalCondition(n, state));
  }
  if (t === 'or' || t === '||'){
    return (args || []).some(n => evalCondition(n, state));
  }
  if (t === 'xor' || t === '^'){
    let count = 0;
    for (const n of (args || [])) if (evalCondition(n, state)) count++;
    return count === 1;
  }

  // Comparisons
  const a = ast.left ?? ast.a ?? ast.lhs ?? (args ? args[0] : undefined);
  const b = ast.right ?? ast.b ?? ast.rhs ?? (args ? args[1] : undefined);
  const av = evalExpr(a, state);
  const bv = evalExpr(b, state);

  switch (t){
    case '==': case '=': return av === bv;
    case '!=': return av !== bv;
    case '<': return av < bv;
    case '<=': return av <= bv;
    case '>': return av > bv;
    case '>=': return av >= bv;
    default:
      // If AST is a bare expression, treat nonzero as true
      return Boolean(av);
  }
}

function applyEffects(statements, state){
  if (!Array.isArray(statements) || statements.length === 0) return;

  for (const st of statements){
    if (!st) continue;
    const varName = st.var ?? st.id ?? st.name ?? st.lhs;
    if (!varName) continue;

    const op = (st.op ?? st.assign ?? '=').toString();
    const expr = st.expr ?? st.value ?? st.rhs ?? st.right;

    const rhs = evalExpr(expr, state);
    const cur = toNumber(state[varName] ?? 0);

    let next = rhs;
    if (op === '+=') next = cur + rhs;
    else if (op === '-=') next = cur - rhs;
    else if (op === '*=') next = cur * rhs;
    else if (op === '/=') next = (rhs === 0 ? cur : cur / rhs);
    else next = rhs;

    state[varName] = next;
  }

  // Temp underscore vars reset when stage closed (_step set to 0)
  if (toNumber(state._step) === 0){
    for (const k of Object.keys(state)){
      if (k.startsWith('_') && k !== '_step' && k !== '_branch'){
        delete state[k];
      }
    }
  }
}

export function Runtime(){
  return { evalCondition, applyEffects };
}
