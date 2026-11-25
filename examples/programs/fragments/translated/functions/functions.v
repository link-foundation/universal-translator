#[bypass_check(guard)]
Fixpoint sum_of_squares (limit : Z) {struct limit} : Z := value (
  let total : Z := 0 in
  total <- for_range 1 (limit + 1) (fun i total =>
    let total := total + square i in
    pure total) total ;;
  stop total)

with square (value_ : Z) {struct value_} : Z := value (
  stop (value_ * value_)).
