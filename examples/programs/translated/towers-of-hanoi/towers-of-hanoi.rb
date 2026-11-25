# Towers of Hanoi in Ruby, solved recursively

def move_disks(count, source, target, spare)
    if count == 0
        return
    end
    move_disks(count - 1, source, spare, target)
    puts "Move disk #{count} from #{source} to #{target}"
    move_disks(count - 1, spare, target, source)
end

move_disks(4, 1, 3, 2)
