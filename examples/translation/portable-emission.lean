inductive Packet where
  | empty : Packet
  | item' : Nat → Packet

def unpack (p : Packet) : Nat :=
  match p with
  | Packet.empty => 0
  | Packet.item' n => n

theorem answer' : 2 + 2 = 4 := by decide
theorem allPackets (p : Packet) : unpack p = unpack p := rfl

def main : IO Unit := do
  IO.println (unpack (Packet.item' (Int.toNat (-7))))
  IO.println (unpack (Packet.item' (Int.toNat 42)))
  IO.println "C:\\draft's"
