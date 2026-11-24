// Generated from data/03-scripts.lino.
export default `profile:
  id: python
  unicodeGreeting: true
  label: Python
  comment: '#'
  call: 'function call'
  output: print
  forms:
    form:
      task: hello
      name: standard
      source: 'print("{{message}}")'
    form:
      task: hello
      name: single-quotes
      source: "print('{{message}}')"
    form:
      task: greatest-common-divisor
      name: standard
      source: '''left = {{left}}
right = {{right}}
while right != 0:
    left, right = right, left % right
print(left)'''
    form:
      task: fizz-buzz
      name: standard
      source: '''limit = {{limit}}
for number in range(1, limit + 1):
    label = ("Fizz" if number % 3 == 0 else "") + ("Buzz" if number % 5 == 0 else "")
    print(label or number)'''
    form:
      task: fizz-buzz
      name: rosetta
      fixed:
        limit: 100
      source: 'for i in range(1,101): print("Fizz"*(i%3==0) + "Buzz"*(i%5==0) or i)'

profile:
  id: ruby
  label: Ruby
  comment: '#'
  call: 'function call'
  output: puts
  forms:
    form:
      task: hello
      name: standard
      source: 'puts "{{message}}"'
    form:
      task: greatest-common-divisor
      name: standard
      source: '''left = {{left}}
right = {{right}}
until right.zero?
  left, right = right, left % right
end
puts left'''
    form:
      task: fizz-buzz
      name: standard
      source: '''limit = {{limit}}
(1..limit).each do |number|
  label = (number % 3 == 0 ? "Fizz" : "") + (number % 5 == 0 ? "Buzz" : "")
  puts(label.empty? ? number : label)
end'''
    form:
      task: fizz-buzz
      name: rosetta
      source: '1.upto({{limit}}) { |i| puts "#{[:Fizz][i%3]}#{[:Buzz][i%5]}"[/.+/] || i }'

profile:
  id: php
  label: PHP
  comment: //
  call: 'function call'
  output: echo
  forms:
    form:
      task: hello
      name: standard
      source: '''<?php
echo "{{message}}\\n";'''
    form:
      task: greatest-common-divisor
      name: standard
      source: '''<?php
$left = {{left}};
$right = {{right}};
while ($right !== 0) {
    [$left, $right] = [$right, $left % $right];
}
echo $left, PHP_EOL;'''
    form:
      task: fizz-buzz
      name: standard
      source: '''<?php
$limit = {{limit}};
for ($number = 1; $number <= $limit; $number++) {
    $label = ($number % 3 === 0 ? "Fizz" : "") . ($number % 5 === 0 ? "Buzz" : "");
    echo ($label === "" ? $number : $label), PHP_EOL;
}'''
  header: 1

profile:
  id: shell
  label: Bash
  comment: '#'
  call: 'function call'
  output: printf
  forms:
    form:
      task: hello
      name: standard
      source: '''#!/bin/sh
printf '%s\\n' '{{message}}''''
    form:
      task: hello
      name: no-shebang
      source: "printf '%s\\n' '{{message}}'"
    form:
      task: greatest-common-divisor
      name: standard
      source: '''#!/bin/sh
left={{left}}
right={{right}}
while [ "$right" -ne 0 ]; do
    remainder=$((left % right))
    left=$right
    right=$remainder
done
printf '%s\\n' "$left"'''
    form:
      task: fizz-buzz
      name: standard
      source: '''#!/bin/sh
limit={{limit}}
number=1
while [ "$number" -le "$limit" ]; do
    if [ "$((number % 15))" -eq 0 ]; then
        printf '%s\\n' FizzBuzz
    elif [ "$((number % 3))" -eq 0 ]; then
        printf '%s\\n' Fizz
    elif [ "$((number % 5))" -eq 0 ]; then
        printf '%s\\n' Buzz
    else
        printf '%s\\n' "$number"
    fi
    number=$((number + 1))
done'''
  header: 1

profile:
  id: perl
  label: Perl
  comment: '#'
  call: 'function call'
  output: print
  forms:
    form:
      task: hello
      name: standard
      source: '''use strict;
use warnings;

print "{{message}}\\n";'''
    form:
      task: hello
      name: collection
      source: 'print "{{message}}\\n";'
    form:
      task: greatest-common-divisor
      name: standard
      source: '''use strict;
use warnings;

my $left = {{left}};
my $right = {{right}};
while ($right != 0) {
    ($left, $right) = ($right, $left % $right);
}
print "$left\\n";'''
    form:
      task: fizz-buzz
      name: standard
      source: '''use strict;
use warnings;

my $limit = {{limit}};
for my $number (1 .. $limit) {
    my $label = ($number % 3 == 0 ? "Fizz" : "") . ($number % 5 == 0 ? "Buzz" : "");
    print (($label eq "" ? $number : $label) . "\\n");
}'''

profile:
  id: r
  label: R
  comment: '#'
  call: 'function call'
  output: cat
  forms:
    form:
      task: hello
      name: standard
      source: 'cat("{{message}}\\n")'
    form:
      task: greatest-common-divisor
      name: standard
      source: '''left <- {{left}}
right <- {{right}}
while (right != 0) {
    remainder <- left %% right
    left <- right
    right <- remainder
}
cat(sprintf("%d\\n", left))'''
    form:
      task: fizz-buzz
      name: standard
      source: '''limit <- {{limit}}
for (number in seq_len(limit)) {
    label <- paste0(if (number %% 3 == 0) "Fizz" else "", if (number %% 5 == 0) "Buzz" else "")
    if (label == "") {
        label <- as.character(number)
    }
    cat(label, "\\n", sep = "")
}'''

profile:
  id: lua
  label: Lua
  comment: --
  call: 'function call'
  output: print
  forms:
    form:
      task: hello
      name: standard
      source: 'print("{{message}}")'
    form:
      task: greatest-common-divisor
      name: standard
      source: '''local left = {{left}}
local right = {{right}}
while right ~= 0 do
    left, right = right, left % right
end
print(left)'''
    form:
      task: fizz-buzz
      name: standard
      source: '''local limit = {{limit}}
for number = 1, limit do
    local label = (number % 3 == 0 and "Fizz" or "") .. (number % 5 == 0 and "Buzz" or "")
    print(label == "" and number or label)
end'''
    form:
      task: fizz-buzz
      name: rosetta
      source: '''word = {"Fizz", "Buzz", "FizzBuzz"}

for i = 1, {{limit}} do
        print(word[(i % 3 == 0 and 1 or 0) + (i % 5 == 0 and 2 or 0)] or i)
end'''

profile:
  id: sqlite
  label: 'SQLite SQL'
  comment: --
  call: query
  output: SELECT
  forms:
    form:
      task: hello
      name: standard
      source: "SELECT '{{message}}';"
    form:
      task: greatest-common-divisor
      name: standard
      source: '''WITH RECURSIVE steps(left_value, right_value) AS (
    VALUES ({{left}}, {{right}})
    UNION ALL
    SELECT right_value, left_value % right_value FROM steps WHERE right_value <> 0
)
SELECT left_value FROM steps WHERE right_value = 0;'''
    form:
      task: fizz-buzz
      name: standard
      source: '''WITH RECURSIVE numbers(number) AS (
    VALUES (1)
    UNION ALL
    SELECT number + 1 FROM numbers WHERE number < {{limit}}
)
SELECT CASE
    WHEN number % 15 = 0 THEN 'FizzBuzz'
    WHEN number % 3 = 0 THEN 'Fizz'
    WHEN number % 5 = 0 THEN 'Buzz'
    ELSE CAST(number AS TEXT)
END
FROM numbers ORDER BY number;'''

profile:
  id: tcl
  label: Tcl
  comment: '#'
  call: 'function call'
  output: puts
  forms:
    form:
      task: hello
      name: standard
      source: 'puts "{{message}}"'
    form:
      task: greatest-common-divisor
      name: standard
      source: '''set left {{left}}
set right {{right}}
while {$right != 0} {
    set remainder [expr {$left % $right}]
    set left $right
    set right $remainder
}
puts $left'''
    form:
      task: fizz-buzz
      name: standard
      source: '''set limit {{limit}}
for {set number 1} {$number <= $limit} {incr number} {
    set label ""
    if {$number % 3 == 0} {append label "Fizz"}
    if {$number % 5 == 0} {append label "Buzz"}
    puts [expr {$label eq "" ? $number : $label}]
}'''

profile:
  id: awk
  label: Awk
  comment: '#'
  call: 'function call'
  output: print
  forms:
    form:
      task: hello
      name: standard
      source: '''BEGIN {
    print "{{message}}"
}'''
    form:
      task: hello
      name: collection
      source: '''BEGIN {
  print "{{message}}"
}'''
    form:
      task: greatest-common-divisor
      name: standard
      source: '''BEGIN {
    left = {{left}}
    right = {{right}}
    while (right != 0) {
        remainder = left % right
        left = right
        right = remainder
    }
    printf "%d\\n", left
}'''
    form:
      task: fizz-buzz
      name: standard
      source: '''BEGIN {
    limit = {{limit}}
    for (number = 1; number <= limit; number++) {
        label = (number % 3 == 0 ? "Fizz" : "") (number % 5 == 0 ? "Buzz" : "")
        print (label == "" ? number : label)
    }
}'''

profile:
  id: powershell
  label: PowerShell
  comment: '#'
  call: 'method call'
  output: '[Console]::WriteLine'
  forms:
    form:
      task: hello
      name: standard
      source: '[Console]::WriteLine("{{message}}")'
    form:
      task: greatest-common-divisor
      name: standard
      source: '''$left = {{left}}
$right = {{right}}
while ($right -ne 0) {
    $left, $right = $right, ($left % $right)
}
[Console]::WriteLine($left)'''
    form:
      task: fizz-buzz
      name: standard
      source: '''$limit = {{limit}}
foreach ($number in 1..$limit) {
    $label = ""
    if ($number % 3 -eq 0) { $label += "Fizz" }
    if ($number % 5 -eq 0) { $label += "Buzz" }
    if ($label.Length -eq 0) { $label = [string]$number }
    [Console]::WriteLine($label)
}'''
`;
