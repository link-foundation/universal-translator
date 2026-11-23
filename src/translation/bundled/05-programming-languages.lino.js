// Generated from ../data/05-programming-languages.lino.
export default `profile:
  id: octave
  label: 'MATLAB (GNU Octave)'
  comment: %
  call: 'function call'
  output: fprintf
  forms:
    form:
      task: hello
      name: standard
      requires: 'GNU Octave'
      source:
        (line: "fprintf('%s\\n', '{{message}}');")
    form:
      task: greatest-common-divisor
      name: standard
      requires: 'GNU Octave'
      source:
        (line: 'left = {{left}};')
        (line: 'right = {{right}};')
        (line: 'while right ~= 0')
        (line: '    remainder = mod(left, right);')
        (line: '    left = right;')
        (line: '    right = remainder;')
        (line: end)
        (line: "fprintf('%d\\n', left);")
    form:
      task: fizz-buzz
      name: standard
      requires: 'GNU Octave'
      source:
        (line: 'for number = 1:{{limit}}')
        (line: '    if mod(number, 15) == 0')
        (line: "        disp('FizzBuzz');")
        (line: '    elseif mod(number, 3) == 0')
        (line: "        disp('Fizz');")
        (line: '    elseif mod(number, 5) == 0')
        (line: "        disp('Buzz');")
        (line: '    else')
        (line: "        fprintf('%d\\n', number);")
        (line: '    end')
        (line: end)

profile:
  id: julia
  label: Julia
  comment: '#'
  call: 'function call'
  output: println
  forms:
    form:
      task: hello
      name: standard
      requires: 'Julia Base'
      source:
        (line: 'println("{{message}}")')
    form:
      task: greatest-common-divisor
      name: standard
      requires: 'Julia Base'
      source:
        (line: 'function greatest_common_divisor(left, right)')
        (line: '    while right != 0')
        (line: '        left, right = right, rem(left, right)')
        (line: '    end')
        (line: '    return left')
        (line: end)
        (line: ~1{})
        (line: 'println(greatest_common_divisor({{left}}, {{right}}))')
    form:
      task: fizz-buzz
      name: standard
      requires: 'Julia Base'
      source:
        (line: 'for number in 1:{{limit}}')
        (line: '    if number % 15 == 0')
        (line: '        println("FizzBuzz")')
        (line: '    elseif number % 3 == 0')
        (line: '        println("Fizz")')
        (line: '    elseif number % 5 == 0')
        (line: '        println("Buzz")')
        (line: '    else')
        (line: '        println(number)')
        (line: '    end')
        (line: end)

profile:
  id: cobol
  label: 'COBOL (GnuCOBOL)'
  comment: *>
  call: 'function call'
  output: display
  forms:
    form:
      task: hello
      name: standard
      requires: 'GnuCOBOL free-format source'
      source:
        (line: 'identification division.')
        (line: 'program-id. main-program.')
        (line: 'data division.')
        (line: 'working-storage section.')
        (line: '01 greeting pic X(97) value "X{{message}}".')
        (line: '01 greeting-length binary-long.')
        (line: 'procedure division.')
        (line: '    compute greeting-length = function length("X{{message}}") - 1')
        (line: '    if greeting-length = 0')
        (line: '        display x"0A" with no advancing')
        (line: '    else')
        (line: '        display greeting(2:greeting-length)')
        (line: '    end-if')
        (line: '    stop run.')
    form:
      task: greatest-common-divisor
      name: standard
      requires: 'GnuCOBOL free-format source'
      source:
        (line: 'identification division.')
        (line: 'program-id. main-program.')
        (line: 'data division.')
        (line: 'working-storage section.')
        (line: '01 left-value pic 9(10) value {{left}}.')
        (line: '01 right-value pic 9(10) value {{right}}.')
        (line: '01 remainder-value pic 9(10).')
        (line: '01 formatted-value pic Z(9)9.')
        (line: 'procedure division.')
        (line: '    perform until right-value = 0')
        (line: '        compute remainder-value = function mod(left-value, right-value)')
        (line: '        move right-value to left-value')
        (line: '        move remainder-value to right-value')
        (line: '    end-perform')
        (line: '    move left-value to formatted-value')
        (line: '    display function trim(formatted-value leading)')
        (line: '    stop run.')
    form:
      task: fizz-buzz
      name: standard
      requires: 'GnuCOBOL free-format source'
      source:
        (line: 'identification division.')
        (line: 'program-id. main-program.')
        (line: 'data division.')
        (line: 'working-storage section.')
        (line: '01 limit-value pic 9(4) value {{limit}}.')
        (line: '01 current-number pic 9(4).')
        (line: '01 formatted-value pic Z(3)9.')
        (line: 'procedure division.')
        (line: '    perform varying current-number from 1 by 1 until current-number > limit-value')
        (line: '        evaluate true')
        (line: '            when function mod(current-number, 15) = 0')
        (line: '                display "FizzBuzz"')
        (line: '            when function mod(current-number, 3) = 0')
        (line: '                display "Fizz"')
        (line: '            when function mod(current-number, 5) = 0')
        (line: '                display "Buzz"')
        (line: '            when other')
        (line: '                move current-number to formatted-value')
        (line: '                display function trim(formatted-value leading)')
        (line: '        end-evaluate')
        (line: '    end-perform')
        (line: '    stop run.')

profile:
  id: ada
  label: Ada
  comment: --
  call: 'function call'
  output: Put_Line
  forms:
    form:
      task: hello
      name: standard
      requires: Ada.Text_IO
      source:
        (line: 'with Ada.Text_IO; use Ada.Text_IO;')
        (line: ~1{})
        (line: 'procedure Main is')
        (line: begin)
        (line: '   Put_Line ("{{message}}");')
        (line: 'end Main;')
    form:
      task: greatest-common-divisor
      name: standard
      requires: Ada.Text_IO
      source:
        (line: 'with Ada.Text_IO; use Ada.Text_IO;')
        (line: 'with Ada.Integer_Text_IO; use Ada.Integer_Text_IO;')
        (line: ~1{})
        (line: 'procedure Main is')
        (line: '   Left : Natural := {{left}};')
        (line: '   Right : Natural := {{right}};')
        (line: '   Remainder : Natural;')
        (line: begin)
        (line: '   while Right /= 0 loop')
        (line: '      Remainder := Left mod Right;')
        (line: '      Left := Right;')
        (line: '      Right := Remainder;')
        (line: '   end loop;')
        (line: '   Put (Left, Width => 0);')
        (line: '   New_Line;')
        (line: 'end Main;')
    form:
      task: fizz-buzz
      name: standard
      requires: Ada.Text_IO
      source:
        (line: 'with Ada.Text_IO; use Ada.Text_IO;')
        (line: 'with Ada.Integer_Text_IO; use Ada.Integer_Text_IO;')
        (line: ~1{})
        (line: 'procedure Main is')
        (line: begin)
        (line: '   for Number in 1 .. {{limit}} loop')
        (line: '      if Number mod 15 = 0 then')
        (line: '         Put_Line ("FizzBuzz");')
        (line: '      elsif Number mod 3 = 0 then')
        (line: '         Put_Line ("Fizz");')
        (line: '      elsif Number mod 5 = 0 then')
        (line: '         Put_Line ("Buzz");')
        (line: '      else')
        (line: '         Put (Number, Width => 0);')
        (line: '         New_Line;')
        (line: '      end if;')
        (line: '   end loop;')
        (line: 'end Main;')

profile:
  id: prolog
  label: 'Prolog (SWI-Prolog)'
  comment: %
  call: 'function call'
  output: writeln
  forms:
    form:
      task: hello
      name: standard
      requires: SWI-Prolog
      source:
        (line: ':- initialization(main, main).')
        (line: ~1{})
        (line: 'main :- writeln("{{message}}").')
    form:
      task: greatest-common-divisor
      name: standard
      requires: SWI-Prolog
      source:
        (line: ':- initialization(main, main).')
        (line: ~1{})
        (line: 'greatest_common_divisor(Left, 0, Left) :- !.')
        (line: 'greatest_common_divisor(Left, Right, Result) :-')
        (line: '    Remainder is Left mod Right,')
        (line: '    greatest_common_divisor(Right, Remainder, Result).')
        (line: ~1{})
        (line: 'main :-')
        (line: '    greatest_common_divisor({{left}}, {{right}}, Result),')
        (line: '    writeln(Result).')
    form:
      task: fizz-buzz
      name: standard
      requires: SWI-Prolog
      source:
        (line: ':- initialization(main, main).')
        (line: ~1{})
        (line: 'fizz_buzz(Number) :-')
        (line: '    ( 0 is Number mod 15 -> writeln("FizzBuzz")')
        (line: '    ; 0 is Number mod 3 -> writeln("Fizz")')
        (line: '    ; 0 is Number mod 5 -> writeln("Buzz")')
        (line: '    ; writeln(Number)')
        (line: '    ).')
        (line: ~1{})
        (line: 'main :- forall(between(1, {{limit}}, Number), fizz_buzz(Number)).')

profile:
  id: d
  label: D
  comment: //
  call: 'function call'
  output: writeln
  forms:
    form:
      task: hello
      name: standard
      requires: std.stdio
      source:
        (line: 'import std.stdio;')
        (line: ~1{})
        (line: 'void main()')
        (line: {)
        (line: '    writeln("{{message}}");')
        (line: })
    form:
      task: greatest-common-divisor
      name: standard
      requires: std.stdio
      source:
        (line: 'import std.stdio;')
        (line: ~1{})
        (line: 'void main()')
        (line: {)
        (line: '    int left = {{left}};')
        (line: '    int right = {{right}};')
        (line: '    while (right != 0)')
        (line: '    {')
        (line: '        int remainder = left % right;')
        (line: '        left = right;')
        (line: '        right = remainder;')
        (line: '    }')
        (line: '    writeln(left);')
        (line: })
    form:
      task: fizz-buzz
      name: standard
      requires: std.stdio
      source:
        (line: 'import std.stdio;')
        (line: ~1{})
        (line: 'void main()')
        (line: {)
        (line: '    foreach (number; 1 .. {{limit}} + 1)')
        (line: '    {')
        (line: '        if (number % 15 == 0) writeln("FizzBuzz");')
        (line: '        else if (number % 3 == 0) writeln("Fizz");')
        (line: '        else if (number % 5 == 0) writeln("Buzz");')
        (line: '        else writeln(number);')
        (line: '    }')
        (line: })

profile:
  id: common-lisp
  label: 'Common Lisp'
  comment: ;
  call: 'function call'
  output: write-line
  forms:
    form:
      task: hello
      name: standard
      requires: 'Common Lisp standard library'
      source:
        (line: '(write-line "{{message}}")')
    form:
      task: greatest-common-divisor
      name: standard
      requires: 'Common Lisp standard library'
      source:
        (line: '(defun greatest-common-divisor (left right)')
        (line: '  (if (zerop right)')
        (line: '      left')
        (line: '      (greatest-common-divisor right (mod left right))))')
        (line: ~1{})
        (line: '(write-line (write-to-string (greatest-common-divisor {{left}} {{right}}) :base 10))')
    form:
      task: fizz-buzz
      name: standard
      requires: 'Common Lisp standard library'
      source:
        (line: '(loop for number from 1 to {{limit}} do')
        (line: '  (write-line')
        (line: '    (cond')
        (line: '      ((zerop (mod number 15)) "FizzBuzz")')
        (line: '      ((zerop (mod number 3)) "Fizz")')
        (line: '      ((zerop (mod number 5)) "Buzz")')
        (line: '      (t (write-to-string number :base 10)))))')

profile:
  id: haskell
  label: Haskell
  comment: --
  call: 'function call'
  output: putStrLn
  forms:
    form:
      task: hello
      name: standard
      requires: Prelude
      source:
        (line: 'main :: IO ()')
        (line: 'main = putStrLn "{{message}}"')
    form:
      task: greatest-common-divisor
      name: standard
      requires: Prelude
      source:
        (line: 'greatestCommonDivisor :: Int -> Int -> Int')
        (line: 'greatestCommonDivisor left 0 = left')
        (line: 'greatestCommonDivisor left right = greatestCommonDivisor right (left \`mod\` right)')
        (line: ~1{})
        (line: 'main :: IO ()')
        (line: 'main = print (greatestCommonDivisor {{left}} {{right}})')
    form:
      task: fizz-buzz
      name: standard
      requires: Prelude
      source:
        (line: 'fizzBuzz :: Int -> String')
        (line: 'fizzBuzz number')
        (line: '  | mod number 15 == 0 = "FizzBuzz"')
        (line: '  | mod number 3 == 0 = "Fizz"')
        (line: '  | mod number 5 == 0 = "Buzz"')
        (line: '  | otherwise = show number')
        (line: ~1{})
        (line: 'main :: IO ()')
        (line: 'main = mapM_ (putStrLn . fizzBuzz) [1 .. {{limit}}]')

profile:
  id: xslt
  label: 'XSLT 1.0'
  comment: <!--
  commentEnd: -->
  call: 'function call'
  output: '<xsl:text>'
  forms:
    form:
      task: hello
      name: standard
      requires: 'XSLT 1.0 processor'
      source:
        (line: '<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">')
        (line: '  <xsl:output method="text"/>')
        (line: '  <xsl:template match="/">')
        (line: '    <xsl:text><![CDATA[{{message}}]]>&#10;</xsl:text>')
        (line: '  </xsl:template>')
        (line: '</xsl:stylesheet>')
    form:
      task: greatest-common-divisor
      name: standard
      requires: 'XSLT 1.0 processor'
      source:
        (line: '<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">')
        (line: '  <xsl:output method="text"/>')
        (line: '  <xsl:template match="/">')
        (line: '    <xsl:call-template name="greatest-common-divisor">')
        (line: '      <xsl:with-param name="left" select="{{left}}"/>')
        (line: '      <xsl:with-param name="right" select="{{right}}"/>')
        (line: '    </xsl:call-template>')
        (line: '    <xsl:text>&#10;</xsl:text>')
        (line: '  </xsl:template>')
        (line: '  <xsl:template name="greatest-common-divisor">')
        (line: '    <xsl:param name="left"/>')
        (line: '    <xsl:param name="right"/>')
        (line: '    <xsl:choose>')
        (line: '      <xsl:when test="$right = 0"><xsl:value-of select="$left"/></xsl:when>')
        (line: '      <xsl:otherwise>')
        (line: '        <xsl:call-template name="greatest-common-divisor">')
        (line: '          <xsl:with-param name="left" select="$right"/>')
        (line: '          <xsl:with-param name="right" select="$left mod $right"/>')
        (line: '        </xsl:call-template>')
        (line: '      </xsl:otherwise>')
        (line: '    </xsl:choose>')
        (line: '  </xsl:template>')
        (line: '</xsl:stylesheet>')
    form:
      task: fizz-buzz
      name: standard
      requires: 'XSLT 1.0 processor'
      source:
        (line: '<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">')
        (line: '  <xsl:output method="text"/>')
        (line: '  <xsl:template match="/">')
        (line: '    <xsl:call-template name="fizz-buzz">')
        (line: '      <xsl:with-param name="limit" select="{{limit}}"/>')
        (line: '    </xsl:call-template>')
        (line: '  </xsl:template>')
        (line: '  <xsl:template name="fizz-buzz">')
        (line: '    <xsl:param name="limit"/>')
        (line: '    <xsl:param name="number" select="1"/>')
        (line: '    <xsl:if test="$number &lt;= $limit">')
        (line: '      <xsl:choose>')
        (line: '        <xsl:when test="$number mod 15 = 0">FizzBuzz</xsl:when>')
        (line: '        <xsl:when test="$number mod 3 = 0">Fizz</xsl:when>')
        (line: '        <xsl:when test="$number mod 5 = 0">Buzz</xsl:when>')
        (line: '        <xsl:otherwise><xsl:value-of select="$number"/></xsl:otherwise>')
        (line: '      </xsl:choose>')
        (line: '      <xsl:text>&#10;</xsl:text>')
        (line: '      <xsl:call-template name="fizz-buzz">')
        (line: '        <xsl:with-param name="limit" select="$limit"/>')
        (line: '        <xsl:with-param name="number" select="$number + 1"/>')
        (line: '      </xsl:call-template>')
        (line: '    </xsl:if>')
        (line: '  </xsl:template>')
        (line: '</xsl:stylesheet>')

profile:
  id: clojure
  label: Clojure
  comment: ;
  call: 'function call'
  output: println
  forms:
    form:
      task: hello
      name: standard
      requires: clojure.core
      source:
        (line: '(println "{{message}}")')
    form:
      task: greatest-common-divisor
      name: standard
      requires: clojure.core
      source:
        (line: '(defn greatest-common-divisor [left right]')
        (line: '  (if (zero? right)')
        (line: '    left')
        (line: '    (recur right (mod left right))))')
        (line: ~1{})
        (line: '(println (greatest-common-divisor {{left}} {{right}}))')
    form:
      task: fizz-buzz
      name: standard
      requires: clojure.core
      source:
        (line: '(doseq [number (range 1 (inc {{limit}}))]')
        (line: '  (println')
        (line: '    (cond')
        (line: '      (zero? (mod number 15)) "FizzBuzz"')
        (line: '      (zero? (mod number 3)) "Fizz"')
        (line: '      (zero? (mod number 5)) "Buzz"')
        (line: '      :else number)))')

profile:
  id: standard-ml
  label: 'Standard ML'
  comment: '(*'
  commentEnd: '*)'
  call: 'function call'
  output: print
  forms:
    form:
      task: hello
      name: standard
      requires: 'Standard ML Basis Library'
      source:
        (line: 'val () = print ("{{message}}" ^ "\\n");')
    form:
      task: greatest-common-divisor
      name: standard
      requires: 'Standard ML Basis Library'
      source:
        (line: 'fun greatestCommonDivisor (left, 0) = left')
        (line: '  | greatestCommonDivisor (left, right) =')
        (line: '      greatestCommonDivisor (right, left mod right);')
        (line: ~1{})
        (line: 'val () = print (Int.toString (greatestCommonDivisor ({{left}}, {{right}})) ^ "\\n");')
    form:
      task: fizz-buzz
      name: standard
      requires: 'Standard ML Basis Library'
      source:
        (line: 'fun fizzBuzz number =')
        (line: '    if number mod 15 = 0 then "FizzBuzz"')
        (line: '    else if number mod 3 = 0 then "Fizz"')
        (line: '    else if number mod 5 = 0 then "Buzz"')
        (line: '    else Int.toString number;')
        (line: ~1{})
        (line: 'fun printThrough (number, limit) =')
        (line: '    if number > limit then ()')
        (line: '    else (print (fizzBuzz number ^ "\\n"); printThrough (number + 1, limit));')
        (line: ~1{})
        (line: 'val () = printThrough (1, {{limit}});')

`;
