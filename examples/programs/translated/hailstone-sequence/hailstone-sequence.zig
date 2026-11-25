// Hailstone sequence in Zig: count the steps to reach 1

const std = @import("std");

var out: *std.Io.Writer = undefined;

fn hailstoneSteps(initial_number: i64) i64 {
    var number: i64 = initial_number;
    var steps: i64 = 0;
    while (number != 1) {
        if (@rem(number, 2) == 0) {
            number = @divTrunc(number, 2);
        } else {
            number = 3 * number + 1;
        }
        steps += 1;
    }
    return steps;
}

pub fn main(init: std.process.Init) void {
    var buffer: [4096]u8 = undefined;
    var writer = std.Io.File.stdout().writer(init.io, &buffer);
    out = &writer.interface;
    defer out.flush() catch {};

    var number: i64 = 1;
    while (number <= 10) : (number += 1) {
        out.print("{d} takes {d} steps\n", .{ number, hailstoneSteps(number) }) catch {};
    }
}
