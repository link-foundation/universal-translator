// Sum multiples of 3 and 5 in Zig: the sum of the multiples below 1000

const std = @import("std");

var out: *std.Io.Writer = undefined;

pub fn main(init: std.process.Init) void {
    var buffer: [4096]u8 = undefined;
    var writer = std.Io.File.stdout().writer(init.io, &buffer);
    out = &writer.interface;
    defer out.flush() catch {};

    var total: i64 = 0;
    var number: i64 = 1;
    while (number <= 999) : (number += 1) {
        if (@rem(number, 3) == 0 or @rem(number, 5) == 0) {
            total += number;
        }
    }
    out.print("{d}\n", .{total}) catch {};
}
