package common

import (
	"context"
)

type ITracer interface {
	StartSpan(context.Context, string, SpanOptions) ISpan
}

type ISpan interface {
	SetError(error)
	Close()
}

var tracer ITracer

func (this Register) Tracer(t ITracer) {
	tracer = t
}

func (this Get) Tracer() ITracer {
	return tracer
}

type SpanOptions struct {
	Kind       string
	Service    string
	Attributes map[string]string
}

func StartSpan(ctx context.Context, name string, opts SpanOptions) ISpan {
	if tracer == nil {
		return noopSpan{}
	}
	return tracer.StartSpan(ctx, name, opts)
}

type noopSpan struct{}

func (noopSpan) Context(ctx context.Context) context.Context { return ctx }
func (noopSpan) SetAttributes(map[string]string)             {}
func (noopSpan) SetError(error)                              {}
func (noopSpan) Close()                                      {}
