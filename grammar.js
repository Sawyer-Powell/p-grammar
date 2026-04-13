/// <reference types="tree-sitter-cli/dsl" />
// Tree-sitter grammar for Microsoft's P language
// Based on the ANTLR grammar (PLexer.g4 / PParser.g4)
// Includes PVerifier extensions (invariants, proofs, quantifiers, etc.)

const PREC = {
  LIFF: -1,
  LTHEN: 0,
  LOR: 1,
  LAND: 2,
  EQ: 3,
  COMP: 4,
  ADD: 5,
  MUL: 6,
  UNARY: 7,
  CAST: 8,
  IS: 8,
  TARGETS: 8,
  ACCESS: 9,
  CALL: 10,
};

module.exports = grammar({
  name: "p",

  extras: ($) => [/\s/, $.line_comment, $.block_comment],

  word: ($) => $.identifier,

  externals: ($) => [],

  inline: ($) => [],

  conflicts: ($) => [],

  rules: {
    // ── Program ─────────────────────────────────────────────────────────
    program: ($) => repeat($._top_decl),

    // ── Top-level declarations ──────────────────────────────────────────
    _top_decl: ($) =>
      choice(
        $.type_def_decl,
        $.enum_type_def_decl,
        $.event_decl,
        $.event_set_decl,
        $.interface_decl,
        $.impl_machine_decl,
        $.spec_machine_decl,
        $.fun_decl,
        $.pure_decl,
        $.named_module_decl,
        $.test_decl,
        $.implementation_decl,
        $.global_param_decl,
        // PVerifier top-level declarations
        $.invariant_decl,
        $.invariant_group_decl,
        $.axiom_decl,
        $.assume_on_start_decl,
        $.proof_block_decl,
      ),

    // ── Type definitions ────────────────────────────────────────────────
    type_def_decl: ($) => choice($.foreign_type_def, $.p_type_def),

    foreign_type_def: ($) => seq("type", field("name", $.identifier), ";"),

    p_type_def: ($) =>
      seq("type", field("name", $.identifier), "=", $._type, ";"),

    // ── Enum definitions ────────────────────────────────────────────────
    enum_type_def_decl: ($) =>
      seq(
        "enum",
        field("name", $.identifier),
        "{",
        choice($.enum_elem_list, $.numbered_enum_elem_list),
        "}",
      ),

    enum_elem_list: ($) => sep1($.enum_elem, ","),

    enum_elem: ($) => field("name", $.identifier),

    numbered_enum_elem_list: ($) => sep1($.numbered_enum_elem, ","),

    numbered_enum_elem: ($) =>
      seq(field("name", $.identifier), "=", field("value", $.int_literal)),

    // ── Event declarations ──────────────────────────────────────────────
    event_decl: ($) =>
      seq(
        "event",
        field("name", $.identifier),
        optional(seq(":", $._type)),
        ";",
      ),

    // ── Event set declarations ──────────────────────────────────────────
    event_set_decl: ($) =>
      seq(
        "eventset",
        field("name", $.identifier),
        "=",
        "{",
        $.event_set_literal,
        "}",
        ";",
      ),

    event_set_literal: ($) => sep1($.non_default_event, ","),

    // ── Interface declarations ──────────────────────────────────────────
    interface_decl: ($) =>
      seq(
        "interface",
        field("name", $.identifier),
        "(",
        optional($._type),
        ")",
        optional(seq("receives", optional($.non_default_event_list))),
        ";",
      ),

    // ── Machine declarations ────────────────────────────────────────────
    impl_machine_decl: ($) =>
      seq(
        "machine",
        field("name", $.identifier),
        repeat($.receives_sends),
        $.machine_body,
      ),

    receives_sends: ($) => choice($.machine_receive, $.machine_send),

    machine_receive: ($) =>
      seq("receives", optional($.event_set_literal), ";"),

    machine_send: ($) =>
      seq("sends", optional($.event_set_literal), ";"),

    spec_machine_decl: ($) =>
      seq(
        "spec",
        field("name", $.identifier),
        "observes",
        $.event_set_literal,
        $.machine_body,
      ),

    machine_body: ($) => seq("{", repeat($._machine_entry), "}"),

    _machine_entry: ($) =>
      choice($.var_decl, $.fun_decl, $.state_decl),

    // ── Variable declarations ───────────────────────────────────────────
    var_decl: ($) => seq("var", $.iden_list, ":", $._type, ";"),

    iden_list: ($) => sep1($.identifier, ","),

    // ── Function declarations ───────────────────────────────────────────
    fun_decl: ($) => choice($.foreign_fun_decl, $.p_fun_decl),

    foreign_fun_decl: ($) =>
      choice(
        seq(
          "fun",
          field("name", $.identifier),
          "(",
          optional($.fun_param_list),
          ")",
          optional(seq(":", $._type)),
          optional(seq("creates", field("interface", $.identifier))),
          ";",
        ),
        // Alternate form with return param, requires, ensures
        seq(
          "fun",
          field("name", $.identifier),
          "(",
          optional($.fun_param_list),
          ")",
          optional(seq("return", "(", $.fun_param, ")", ";")),
          repeat(seq("requires", $._expr, ";")),
          repeat(seq("ensures", $._expr, ";")),
        ),
      ),

    p_fun_decl: ($) =>
      seq(
        "fun",
        field("name", $.identifier),
        "(",
        optional($.fun_param_list),
        ")",
        optional(seq(":", $._type)),
        $.function_body,
      ),

    fun_param_list: ($) => sep1($.fun_param, ","),

    fun_param: ($) =>
      seq(field("name", $.identifier), ":", field("type", $._type)),

    // ── Pure function declarations (PVerifier) ──────────────────────────
    pure_decl: ($) =>
      seq(
        "pure",
        field("name", $.identifier),
        "(",
        optional($.fun_param_list),
        ")",
        ":",
        $._type,
        optional(seq("=", field("body", $._expr))),
        ";",
      ),

    // ── State declarations ──────────────────────────────────────────────
    state_decl: ($) =>
      seq(
        optional("start"),
        optional(field("temperature", choice("hot", "cold"))),
        "state",
        field("name", $.identifier),
        "{",
        repeat($._state_body_item),
        "}",
      ),

    _state_body_item: ($) =>
      choice(
        $.state_entry,
        $.state_exit,
        $.state_defer,
        $.state_ignore,
        $.on_event_do_action,
        $.on_event_goto_state,
      ),

    state_entry: ($) =>
      seq(
        "entry",
        choice(
          $.anon_event_handler,
          seq(field("fun_name", $.identifier), ";"),
        ),
      ),

    state_exit: ($) =>
      seq(
        "exit",
        choice(
          $.no_param_anon_event_handler,
          seq(field("fun_name", $.identifier), ";"),
        ),
      ),

    state_defer: ($) => seq("defer", $.non_default_event_list, ";"),

    state_ignore: ($) => seq("ignore", $.non_default_event_list, ";"),

    on_event_do_action: ($) =>
      seq(
        "on",
        $.event_list,
        "do",
        choice(
          seq(field("fun_name", $.identifier), ";"),
          $.anon_event_handler,
        ),
      ),

    on_event_goto_state: ($) =>
      seq(
        "on",
        $.event_list,
        "goto",
        $.state_name,
        choice(
          ";",
          seq(
            "with",
            choice(
              $.anon_event_handler,
              seq(field("fun_name", $.identifier), ";"),
            ),
          ),
        ),
      ),

    non_default_event_list: ($) => sep1($.non_default_event, ","),

    non_default_event: ($) => choice("halt", $.identifier),

    event_list: ($) => sep1($.event_id, ","),

    event_id: ($) => choice("null", "halt", $.identifier),

    state_name: ($) => field("state", $.identifier),

    // ── Event handlers ──────────────────────────────────────────────────
    anon_event_handler: ($) =>
      seq(optional(seq("(", $.fun_param, ")")), $.function_body),

    no_param_anon_event_handler: ($) => $.function_body,

    // ── Function body ───────────────────────────────────────────────────
    function_body: ($) =>
      seq("{", repeat(choice($.var_decl, $._statement)), "}"),

    // ── Statements ──────────────────────────────────────────────────────
    _statement: ($) =>
      choice(
        $.compound_stmt,
        $.assert_stmt,
        $.assume_stmt,
        $.print_stmt,
        $.return_stmt,
        $.break_stmt,
        $.continue_stmt,
        $.assign_stmt,
        $.insert_stmt,
        $.add_stmt,
        $.remove_stmt,
        $.while_stmt,
        $.foreach_stmt,
        $.if_stmt,
        $.ctor_stmt,
        $.fun_call_stmt,
        $.raise_stmt,
        $.send_stmt,
        $.announce_stmt,
        $.goto_stmt,
        $.receive_stmt,
        $.no_stmt,
      ),

    compound_stmt: ($) => seq("{", repeat($._statement), "}"),

    assert_stmt: ($) =>
      seq(
        "assert",
        field("assertion", $._expr),
        optional(seq(",", field("message", $._expr))),
        ";",
      ),

    assume_stmt: ($) =>
      seq(
        "assume",
        field("assumption", $._expr),
        optional(seq(",", field("message", $._expr))),
        ";",
      ),

    print_stmt: ($) => seq("print", field("message", $._expr), ";"),

    return_stmt: ($) => seq("return", optional($._expr), ";"),

    break_stmt: ($) => seq("break", ";"),

    continue_stmt: ($) => seq("continue", ";"),

    assign_stmt: ($) =>
      seq($.lvalue, "=", field("rvalue", $._expr), ";"),

    insert_stmt: ($) =>
      seq(
        $.lvalue,
        "+=",
        "(",
        $._expr,
        ",",
        field("rvalue", $._expr),
        ")",
        ";",
      ),

    add_stmt: ($) =>
      seq($.lvalue, "+=", "(", field("rvalue", $._expr), ")", ";"),

    remove_stmt: ($) =>
      seq($.lvalue, "-=", field("value", $._expr), ";"),

    while_stmt: ($) =>
      seq("while", "(", field("condition", $._expr), ")", $._statement),

    foreach_stmt: ($) =>
      seq(
        "foreach",
        "(",
        field("item", $.identifier),
        "in",
        field("collection", $._expr),
        ")",
        repeat(seq("invariant", $._expr, ";")),
        $._statement,
      ),

    if_stmt: ($) =>
      prec.right(
        seq(
          "if",
          "(",
          field("condition", $._expr),
          ")",
          field("then", $._statement),
          optional(seq("else", field("else", $._statement))),
        ),
      ),

    ctor_stmt: ($) =>
      seq("new", $.identifier, "(", optional($.rvalue_list), ")", ";"),

    fun_call_stmt: ($) =>
      seq(
        field("fun", $.identifier),
        "(",
        optional($.rvalue_list),
        ")",
        ";",
      ),

    raise_stmt: ($) =>
      seq("raise", $._expr, optional(seq(",", $.rvalue_list)), ";"),

    send_stmt: ($) =>
      seq(
        "send",
        field("machine", $._expr),
        ",",
        field("event", $._expr),
        optional(seq(",", $.rvalue_list)),
        ";",
      ),

    announce_stmt: ($) =>
      seq("announce", $._expr, optional(seq(",", $.rvalue_list)), ";"),

    goto_stmt: ($) =>
      seq(
        "goto",
        $.state_name,
        optional(seq(",", $.rvalue_list)),
        ";",
      ),

    receive_stmt: ($) => seq("receive", "{", repeat1($.recv_case), "}"),

    recv_case: ($) =>
      seq("case", $.event_list, ":", $.anon_event_handler),

    no_stmt: ($) => ";",

    // ── Lvalues ─────────────────────────────────────────────────────────
    lvalue: ($) =>
      prec.left(
        PREC.ACCESS,
        choice(
          field("name", $.identifier),
          seq($.lvalue, ".", field("field", $.identifier)),
          seq($.lvalue, ".", field("index", $.int_literal)),
          seq($.lvalue, "[", $._expr, "]"),
        ),
      ),

    // ── Expressions ─────────────────────────────────────────────────────
    _expr: ($) =>
      choice(
        $._primitive,
        $.string_literal,
        $.unnamed_tuple_expr,
        $.named_tuple_expr,
        $.paren_expr,
        $.named_tuple_access_expr,
        $.tuple_access_expr,
        $.seq_access_expr,
        $.keyword_expr,
        $.ctor_expr,
        $.fun_call_expr,
        $.unary_expr,
        $.bin_expr,
        $.cast_expr,
        $.choose_expr,
        $.format_expr,
        // PVerifier expressions
        $.quant_expr,
        $.is_expr,
        $.targets_expr,
        $.inflight_expr,
        $.sent_expr,
      ),

    paren_expr: ($) => seq("(", $._expr, ")"),

    named_tuple_access_expr: ($) =>
      prec.left(
        PREC.ACCESS,
        seq($._expr, ".", field("field", $.identifier)),
      ),

    tuple_access_expr: ($) =>
      prec.left(
        PREC.ACCESS,
        seq($._expr, ".", field("field", $.int_literal)),
      ),

    seq_access_expr: ($) =>
      prec.left(
        PREC.ACCESS,
        seq(
          field("seq", $._expr),
          "[",
          field("index", $._expr),
          "]",
        ),
      ),

    keyword_expr: ($) =>
      choice(
        seq("keys", "(", $._expr, ")"),
        seq("values", "(", $._expr, ")"),
        seq("sizeof", "(", $._expr, ")"),
        seq("default", "(", $._type, ")"),
      ),

    ctor_expr: ($) =>
      prec(
        PREC.CALL,
        seq("new", $.identifier, "(", optional($.rvalue_list), ")"),
      ),

    fun_call_expr: ($) =>
      prec(
        PREC.CALL,
        seq(
          field("fun", $.identifier),
          "(",
          optional($.rvalue_list),
          ")",
        ),
      ),

    unary_expr: ($) =>
      prec(PREC.UNARY, seq(choice("-", "!"), $._expr)),

    bin_expr: ($) =>
      choice(
        prec.left(
          PREC.MUL,
          seq($._expr, choice("*", "/", "%"), $._expr),
        ),
        prec.left(
          PREC.ADD,
          seq($._expr, choice("+", "-"), $._expr),
        ),
        prec.left(
          PREC.COMP,
          seq($._expr, choice("<", ">", ">=", "<=", "in"), $._expr),
        ),
        prec.left(PREC.EQ, seq($._expr, choice("==", "!="), $._expr)),
        prec.left(PREC.LAND, seq($._expr, "&&", $._expr)),
        prec.left(PREC.LOR, seq($._expr, "||", $._expr)),
        // PVerifier logical operators
        prec.right(PREC.LTHEN, seq($._expr, "==>", $._expr)),
        prec.left(PREC.LIFF, seq($._expr, "<==>", $._expr)),
      ),

    cast_expr: ($) =>
      prec.left(PREC.CAST, seq($._expr, choice("as", "to"), $._type)),

    choose_expr: ($) => seq("choose", "(", optional($._expr), ")"),

    // PVerifier: forall/exists quantifier expressions
    quant_expr: ($) =>
      prec.right(
        seq(
          choice("forall", "exists"),
          optional("new"),
          "(",
          $.fun_param_list,
          ")",
          "::",
          field("body", $._expr),
        ),
      ),

    // PVerifier: type test expression (e is Type)
    is_expr: ($) =>
      prec.left(
        PREC.IS,
        seq(field("instance", $._expr), "is", field("kind", $.identifier)),
      ),

    // PVerifier: targets expression (e targets target)
    targets_expr: ($) =>
      prec.left(
        PREC.TARGETS,
        seq(
          field("instance", $._expr),
          "targets",
          field("target", $._expr),
        ),
      ),

    // PVerifier: inflight expression
    inflight_expr: ($) =>
      prec(PREC.UNARY, seq("inflight", field("instance", $._expr))),

    // PVerifier: sent expression
    sent_expr: ($) =>
      prec(PREC.UNARY, seq("sent", field("instance", $._expr))),

    unnamed_tuple_expr: ($) =>
      seq("(", $._expr, ",", optional(sep1($._expr, ",")), ")"),

    named_tuple_expr: ($) =>
      seq("(", sep1($.named_tuple_field, ","), optional(","), ")"),

    named_tuple_field: ($) =>
      seq(field("name", $.identifier), "=", field("value", $._expr)),

    format_expr: ($) =>
      seq(
        "format",
        "(",
        $.string_literal,
        optional(seq(",", $.rvalue_list)),
        ")",
      ),

    rvalue_list: ($) => sep1($._expr, ","),

    // ── Primitives ──────────────────────────────────────────────────────
    _primitive: ($) =>
      choice(
        $.identifier,
        $.float_literal,
        $.bool_literal,
        $.int_literal,
        $.null_literal,
        $.nondet,
        $.fairnondet,
        $.halt_keyword,
        $.this_keyword,
      ),

    // Float literals: use a single token to avoid ambiguity with dot access
    float_literal: ($) =>
      choice(
        token(seq(optional(/[0-9]+/), ".", /[0-9]+/)),
        seq(
          "float",
          "(",
          field("base", $.int_literal),
          ",",
          field("exp", $.int_literal),
          ")",
        ),
      ),

    bool_literal: ($) => choice("true", "false"),

    null_literal: ($) => "null",

    nondet: ($) => "$",

    fairnondet: ($) => "$$",

    halt_keyword: ($) => "halt",

    this_keyword: ($) => "this",

    // ── Types ───────────────────────────────────────────────────────────
    _type: ($) =>
      choice(
        $.seq_type,
        $.set_type,
        $.map_type,
        $.tuple_type,
        $.named_tuple_type,
        $.primitive_type,
        $.named_type,
      ),

    seq_type: ($) => seq("seq", "[", $._type, "]"),

    set_type: ($) => seq("set", "[", $._type, "]"),

    map_type: ($) =>
      seq(
        "map",
        "[",
        field("key_type", $._type),
        ",",
        field("value_type", $._type),
        "]",
      ),

    tuple_type: ($) =>
      seq("(", $._type, repeat1(seq(",", $._type)), ")"),

    named_tuple_type: ($) => seq("(", $.iden_type_list, ")"),

    iden_type_list: ($) => sep1($.iden_type, ","),

    iden_type: ($) =>
      seq(field("name", $.identifier), ":", field("type", $._type)),

    primitive_type: ($) =>
      choice(
        "bool",
        "int",
        "float",
        "string",
        "event",
        "machine",
        "data",
        "any",
      ),

    named_type: ($) => field("name", $.identifier),

    // ── Module system ───────────────────────────────────────────────────
    named_module_decl: ($) =>
      seq("module", field("name", $.identifier), "=", $._mod_expr, ";"),

    _mod_expr: ($) =>
      choice(
        $.paren_module_expr,
        $.primitive_module_expr,
        $.named_module,
        $.compose_module_expr,
        $.union_module_expr,
        $.hide_events_module_expr,
        $.hide_interfaces_module_expr,
        $.assert_module_expr,
        $.rename_module_expr,
        $.main_machine_module_expr,
      ),

    paren_module_expr: ($) => seq("(", $._mod_expr, ")"),

    primitive_module_expr: ($) =>
      seq("{", sep1($.bind_expr, ","), "}"),

    bind_expr: ($) =>
      seq(
        field("machine_name", $.identifier),
        optional(seq("->", field("interface_name", $.identifier))),
      ),

    named_module: ($) => $.identifier,

    compose_module_expr: ($) =>
      prec.left(
        seq("compose", $._mod_expr, repeat1(seq(",", $._mod_expr))),
      ),

    union_module_expr: ($) =>
      prec.left(
        seq("union", $._mod_expr, repeat1(seq(",", $._mod_expr))),
      ),

    hide_events_module_expr: ($) =>
      seq("hidee", $.non_default_event_list, "in", $._mod_expr),

    hide_interfaces_module_expr: ($) =>
      seq("hidei", $.iden_list, "in", $._mod_expr),

    assert_module_expr: ($) =>
      seq("assert", $.iden_list, "in", $._mod_expr),

    rename_module_expr: ($) =>
      seq(
        "rename",
        field("old_name", $.identifier),
        "to",
        field("new_name", $.identifier),
        "in",
        $._mod_expr,
      ),

    main_machine_module_expr: ($) =>
      seq(
        "main",
        field("main_machine", $.identifier),
        "in",
        $._mod_expr,
      ),

    // ── Test declarations ───────────────────────────────────────────────
    test_decl: ($) => choice($.safety_test_decl, $.refinement_test_decl),

    safety_test_decl: ($) =>
      seq(
        "test",
        optional($.test_param),
        optional(seq("assume", $._expr)),
        optional($.twise),
        field("name", $.identifier),
        "[",
        "main",
        "=",
        field("main_machine", $.identifier),
        "]",
        ":",
        $._mod_expr,
        ";",
      ),

    refinement_test_decl: ($) =>
      seq(
        "test",
        field("name", $.identifier),
        "[",
        "main",
        "=",
        field("main_machine", $.identifier),
        "]",
        ":",
        $._mod_expr,
        "refines",
        $._mod_expr,
        ";",
      ),

    test_param: ($) => seq("param", "(", $.param_body, ")"),

    param_body: ($) =>
      sep1(seq($.identifier, "in", $.seq_literal), ","),

    seq_literal: ($) => seq("[", $.seq_literal_body, "]"),

    seq_literal_body: ($) => sep1($._seq_primitive, ","),

    _seq_primitive: ($) =>
      choice($.bool_literal, $.int_literal, seq("-", $.int_literal)),

    twise: ($) =>
      choice("pairwise", seq("(", $.int_literal, "wise", ")")),

    // ── Implementation declarations ─────────────────────────────────────
    implementation_decl: ($) =>
      seq(
        "implementation",
        field("name", $.identifier),
        optional(
          seq(
            "[",
            "main",
            "=",
            field("main_machine", $.identifier),
            "]",
          ),
        ),
        ":",
        $._mod_expr,
        ";",
      ),

    // ── Global param declarations ───────────────────────────────────────
    global_param_decl: ($) =>
      seq("param", $.iden_list, ":", $._type, ";"),

    // ── PVerifier: invariant declarations ────────────────────────────────
    invariant_decl: ($) =>
      seq(
        "invariant",
        field("name", $.identifier),
        ":",
        field("body", $._expr),
        ";",
      ),

    // ── PVerifier: invariant groups (Lemma / Theorem) ───────────────────
    invariant_group_decl: ($) =>
      seq(
        choice("Lemma", "Theorem"),
        field("name", $.identifier),
        "{",
        repeat($.invariant_decl),
        "}",
      ),

    // ── PVerifier: axiom declarations ───────────────────────────────────
    axiom_decl: ($) => seq("axiom", field("body", $._expr), ";"),

    // ── PVerifier: init-condition declarations ──────────────────────────
    assume_on_start_decl: ($) =>
      seq("init-condition", field("body", $._expr), ";"),

    // ── PVerifier: proof blocks ─────────────────────────────────────────
    proof_block_decl: ($) =>
      seq(
        "Proof",
        optional(field("name", $.identifier)),
        "{",
        repeat($.proof_item),
        "}",
      ),

    proof_item: ($) =>
      seq(
        "prove",
        choice(
          sep1($._expr, ","),
          "*",
          "default",
        ),
        optional(
          seq(
            "using",
            choice(sep1($._expr, ","), "*"),
          ),
        ),
        optional(
          seq("except", sep1($._expr, ",")),
        ),
        ";",
      ),

    // ── Identifiers and literals ────────────────────────────────────────
    identifier: ($) => /[a-zA-Z_][a-zA-Z0-9_]*/,

    int_literal: ($) => /[0-9]+/,

    string_literal: ($) =>
      seq('"', repeat(choice(/[^"\\]+/, $.escape_sequence)), '"'),

    escape_sequence: ($) => token.immediate(/\\./),

    // ── Comments ────────────────────────────────────────────────────────
    line_comment: ($) => token(seq("//", /[^\r\n]*/)),

    block_comment: ($) =>
      token(seq("/*", /[^*]*\*+([^/*][^*]*\*+)*/, "/")),
  },
});

// Helper: separated list with at least 1 element
function sep1(rule, separator) {
  return seq(rule, repeat(seq(separator, rule)));
}
