(* Standard-output operations of the common library for Rocq. A program loads
   this file after its runtime, which defines actions, print and show. *)

Module CommonLibrary.

Definition print_line (text : string) : Action unit unit := print_line text.

Definition write_text (text : string) : Action unit unit := print text.

Definition write_integer (integer : Z) : Action unit unit := print (show integer).

(* Rocq calls a function without parameters with the unit value: end_line tt. *)
Definition end_line (_ : unit) : Action unit unit := print line_end.

End CommonLibrary.
