#[bypass_check(guard)]
Fixpoint square (value_ : Z) {struct value_} : Z := value (
  stop (value_ * value_)).
