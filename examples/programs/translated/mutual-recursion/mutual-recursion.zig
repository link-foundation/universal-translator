// Mutual recursion in Zig: the Hofstadter Female and Male sequences

const std = @import("std");

var out: *std.Io.Writer = undefined;

fn female(index: i64) i64 {
    if (index == 0) {
        return 1;
    }
    return index - male(female(index - 1));
}

fn male(index: i64) i64 {
    if (index == 0) {
        return 0;
    }
    return index - female(male(index - 1));
}

pub fn main(init: std.process.Init) void {
    var buffer: [4096]u8 = undefined;
    var writer = std.Io.File.stdout().writer(init.io, &buffer);
    out = &writer.interface;
    defer out.flush() catch {};

    var index: i64 = 0;
    while (index <= 19) : (index += 1) {
        out.print("{d}: {d} {d}\n", .{ index, female(index), male(index) }) catch {};
    }
}
