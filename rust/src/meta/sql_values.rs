//! Nullable SQL operations remain distinct from host-language operations.
pub(crate) fn binary(operator: &str) -> bool {
    matches!(
        operator,
        "add"
            | "subtract"
            | "multiply"
            | "divide"
            | "realDivide"
            | "remainder"
            | "equal"
            | "notEqual"
            | "less"
            | "lessOrEqual"
            | "greater"
            | "greaterOrEqual"
            | "and"
            | "or"
            | "is"
            | "isNot"
    )
}
pub(crate) fn unary(operator: &str) -> bool {
    matches!(
        operator,
        "not" | "negate" | "isTrue" | "isFalse" | "isNotTrue" | "isNotFalse"
    )
}
