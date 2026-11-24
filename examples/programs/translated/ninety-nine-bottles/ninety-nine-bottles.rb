# 99 bottles of beer in Ruby

bottles = 99
while bottles > 0
    puts "#{bottles} bottles of beer on the wall, #{bottles} bottles of beer."
    puts "Take one down and pass it around, #{bottles - 1} bottles of beer on the wall."
    bottles -= 1
end
