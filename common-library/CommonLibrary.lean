-- Standard-output operations of the common library for Lean.

namespace CommonLibrary

def printLine (text : String) : IO Unit := IO.println text

def writeText (text : String) : IO Unit := IO.print text

def writeInteger (integer : Int) : IO Unit := IO.print integer

-- Lean calls a function without parameters with the unit value: endLine ().
def endLine (_ : Unit) : IO Unit := IO.println ""

end CommonLibrary
