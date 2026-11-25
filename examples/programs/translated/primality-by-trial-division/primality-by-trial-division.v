From Stdlib Require Import ZArith String Ascii List.
Import ListNotations.
Open Scope string_scope.
Open Scope bool_scope.
Open Scope Z_scope.
Inductive Outcome (Result State : Type) : Type :=
  | Going : State -> string -> Outcome Result State
  | Returned : Result -> string -> Outcome Result State.
Arguments Going {Result State}.
Arguments Returned {Result State}.
Definition Action (Result State : Type) := string -> Outcome Result State.
Definition pure {Result State} (state : State) : Action Result State :=
  fun output => Going state output.
Definition stop {Result State} (result : Result) : Action Result State :=
  fun output => Returned result output.
Definition bind {Result State Next} (first : Action Result State)
  (rest : State -> Action Result Next) : Action Result Next :=
  fun output => match first output with
    | Going state written => rest state written
    | Returned result written => Returned result written
    end.
Notation "x <- first ;; rest" := (bind first (fun x => rest))
  (at level 100, first at next level, right associativity).
Notation "' pattern <- first ;; rest" := (bind first (fun pattern => rest))
  (at level 100, pattern pattern, first at next level, right associativity).
Notation "first ;; rest" := (bind first (fun _ : unit => rest))
  (at level 100, right associativity).
#[bypass_check(guard)]
Fixpoint loop_while {Result State} (condition : State -> bool)
  (body : State -> Action Result State) (state : State) (output : string)
  {struct output} : Outcome Result State :=
  if condition state then
    match body state output with
    | Going next written => loop_while condition body next written
    | Returned result written => Returned result written
    end
  else Going state output.
Definition for_range {Result State} (start finish : Z)
  (body : Z -> State -> Action Result State) (state : State)
  : Action Result State :=
  bind (loop_while (fun '(index, _) => index <? finish)
    (fun '(index, current) =>
       bind (body index current) (fun next => pure (index + 1, next)))
    (start, state)) (fun '(_, final) => pure final).
Definition line_end := String (ascii_of_nat 10) EmptyString.
Definition print {Result} (text : string) : Action Result unit :=
  fun output => Going tt (output ++ text).
Definition print_line {Result} (text : string) : Action Result unit :=
  print (text ++ line_end).
#[bypass_check(guard)]
Fixpoint digits (number : Z) (written : string) {struct number} : string :=
  let digit := String (ascii_of_nat (48 + Z.to_nat (number mod 10))) EmptyString in
  if number <? 10 then digit ++ written else digits (number / 10) (digit ++ written).
Class Show (T : Type) := show : T -> string.
#[export] Instance show_integer : Show Z := fun number =>
  if number <? 0 then "-" ++ digits (- number) "" else digits number "".
#[export] Instance show_boolean : Show bool := fun truth =>
  if truth then "true" else "false".
#[export] Instance show_text : Show string := fun text => text.
Class Default (T : Type) := default : T.
#[export] Instance default_integer : Default Z := 0.
#[export] Instance default_boolean : Default bool := false.
#[export] Instance default_text : Default string := "".
#[export] Instance default_array : Default (list Z) := [].
Definition value {Result} (body : Action Result Result) : Result :=
  match body "" with Going result _ => result | Returned result _ => result end.
Definition call {Result} (procedure : Action unit unit) : Action Result unit :=
  fun output => match procedure output with
    | Going _ written => Going tt written
    | Returned _ written => Going tt written
    end.
Definition run (main : Action unit unit) : string :=
  match main "" with Going _ written => written | Returned _ written => written end.
Definition item (array : list Z) (index : Z) : Z := List.nth (Z.to_nat index) array 0.
Fixpoint with_item_at (array : list Z) (index : nat) (value : Z) : list Z :=
  match array, index with
  | nil, _ => nil
  | cons _ rest, O => cons value rest
  | cons first rest, S next => cons first (with_item_at rest next value)
  end.
Definition with_item array index value := with_item_at array (Z.to_nat index) value.
Definition filled (length : Z) (value : Z) : list Z := List.repeat value (Z.to_nat length).
Definition size (array : list Z) : Z := Z.of_nat (List.length array).
Set Warnings "-non-recursive".

(* Primality by trial division in Rocq *)

#[bypass_check(guard)]
Fixpoint is_prime (number : Z) {struct number} : bool := value (
  (if number <? 2 then
    stop false
  else
    pure tt) ;;
  let divisor : Z := 2 in
  divisor <- loop_while (fun divisor => divisor * divisor <=? number) (fun divisor =>
    (if Z.rem number divisor =? 0 then
      stop false
    else
      pure tt) ;;
    let divisor := divisor + 1 in
    pure divisor) divisor ;;
  stop true).

Definition main : Action unit unit := (
  for_range 1 51 (fun number _ =>
    (if is_prime number then
      print_line (show number) ;;
      pure tt
    else
      pure tt) ;;
    pure tt) tt ;;
  pure tt).

Eval vm_compute in run main.
