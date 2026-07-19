"""Ported from frontend/src/lib/downtime.js - formula evaluator + action catalog.

Formulas are not user input - they come only from data/downtime-actions.json,
checked into version control, same trust boundary as the original JS.
"""
import json
import math
import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
DOWNTIME_ACTIONS_PATH = REPO_ROOT / "data" / "downtime-actions.json"

_actions_cache = None


def load_downtime_actions():
    global _actions_cache
    if _actions_cache is None:
        _actions_cache = json.loads(DOWNTIME_ACTIONS_PATH.read_text())
    return _actions_cache


def get_action(category, action_id):
    actions = load_downtime_actions()
    for action in actions.get(category, []):
        if action["id"] == action_id:
            return action
    return None


def _tokenize(expression):
    tokens = []
    i = 0
    n = len(expression)
    while i < n:
        ch = expression[i]
        if ch in " \t\n\r":
            i += 1
            continue
        if ch.isdigit() or (ch == "." and i + 1 < n and expression[i + 1].isdigit()):
            num = ch
            i += 1
            while i < n and (expression[i].isdigit() or expression[i] == "."):
                num += expression[i]
                i += 1
            tokens.append(("number", num))
            continue
        if ch.isalpha() or ch == "_":
            ident = ch
            i += 1
            while i < n and (expression[i].isalnum() or expression[i] == "_"):
                ident += expression[i]
                i += 1
            tokens.append(("identifier", ident))
            continue
        if ch in "+-*/":
            tokens.append(("operator", ch))
            i += 1
            continue
        if ch in "()":
            tokens.append(("paren", ch))
            i += 1
            continue
        raise ValueError(f"Unsupported character in expression: {ch}")
    return tokens


_OP_PRECEDENCE = {"+": 1, "-": 1, "*": 2, "/": 2}


def _to_rpn(tokens):
    output = []
    ops = []
    for token in tokens:
        ttype, tval = token
        if ttype in ("number", "identifier"):
            output.append(token)
        elif ttype == "operator":
            while ops and ops[-1][0] == "operator" and _OP_PRECEDENCE[ops[-1][1]] >= _OP_PRECEDENCE[tval]:
                output.append(ops.pop())
            ops.append(token)
        elif ttype == "paren" and tval == "(":
            ops.append(token)
        elif ttype == "paren" and tval == ")":
            found_left = False
            while ops:
                top = ops.pop()
                if top[0] == "paren" and top[1] == "(":
                    found_left = True
                    break
                output.append(top)
            if not found_left:
                raise ValueError("Mismatched parentheses")
    while ops:
        top = ops.pop()
        if top[0] == "paren":
            raise ValueError("Mismatched parentheses")
        output.append(top)
    return output


def _eval_rpn(rpn, context):
    stack = []
    for ttype, tval in rpn:
        if ttype == "number":
            stack.append(float(tval))
        elif ttype == "identifier":
            value = context.get(tval)
            stack.append(value if isinstance(value, (int, float)) else 0)
        elif ttype == "operator":
            if len(stack) < 2:
                raise ValueError("Insufficient values in expression")
            b = stack.pop()
            a = stack.pop()
            if tval == "+":
                result = a + b
            elif tval == "-":
                result = a - b
            elif tval == "*":
                result = a * b
            elif tval == "/":
                if b == 0:
                    raise ValueError("Division by zero")
                result = a / b
            else:
                raise ValueError(f"Unknown operator: {tval}")
            stack.append(result)
    if len(stack) != 1:
        raise ValueError("Invalid expression")
    return stack[0]


_SAFE_PATTERN = re.compile(r"^[\w\d\s+\-*/().]+$")


def evaluate_downtime_cost(formula, context):
    try:
        if not isinstance(formula, str) or formula.strip() == "":
            return 0
        if not _SAFE_PATTERN.match(formula):
            return 0
        tokens = _tokenize(formula)
        rpn = _to_rpn(tokens)
        raw_result = _eval_rpn(rpn, context or {})
        if not isinstance(raw_result, (int, float)):
            return 0
        rounded = math.ceil(raw_result)
        return max(0, rounded)
    except Exception:
        return 0
