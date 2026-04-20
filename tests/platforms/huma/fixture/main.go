package main

import (
	"context"
	"net/http"
	"os"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/danielgtaylor/huma/v2/adapters/humago"
)

type SimpleRecord struct {
	ID     string `json:"id"`
	Source string `json:"source"`
}

type CreateItemRequest struct {
	Name string `json:"name"`
}

type CollisionValueResponse struct {
	Value string `json:"value"`
}

type DocumentResponse struct {
	Value string `json:"value"`
}

type ResponseCollisionBody struct {
	ETag string `json:"etag"`
}

type CoordinatePoint struct {
	X int `json:"x"`
	Y int `json:"y"`
}

type NullablePoint struct {
	_ struct{} `nullable:"true"`
	X int      `json:"x"`
	Y int      `json:"y"`
}

type NullabilityEnvelope struct {
	NonNullableText      string          `json:"nonNullableText"`
	NullableText         *string         `json:"nullableText,omitempty" nullable:"true"`
	NonNullableCount     int             `json:"nonNullableCount"`
	NullableCount        *int            `json:"nullableCount,omitempty" nullable:"true"`
	NonNullableTimestamp time.Time       `json:"nonNullableTimestamp"`
	NullableTimestamp    *time.Time      `json:"nullableTimestamp,omitempty" nullable:"true"`
	NonNullablePoint     CoordinatePoint `json:"nonNullablePoint"`
	NullablePoint        *NullablePoint  `json:"nullablePoint,omitempty"`
}

type ObjectEnvelope struct {
	ObjectName string `json:"objectName"`
	Kind       string `json:"kind" enum:"Alpha,Beta"`
}

type HiddenEnvelope struct {
	VisibleName string `json:"visibleName"`
	Hidden      string `json:"-"`
}

type AttributedEnvelope struct {
	RenamedValue *string `json:"renamed-value,omitempty" nullable:"true"`
}

type NumericEnumEnvelope struct {
	Status int `json:"status" enum:"0,1"`
}

type SymbolicEnumEnvelope struct {
	Status string `json:"status" enum:"Alpha,Beta"`
}

type DocumentedEnvelope struct {
	Title        string  `json:"title" doc:"A required title from Huma doc tags."`
	OptionalNote *string `json:"optionalNote,omitempty" doc:"An optional note from Huma doc tags." nullable:"true"`
}

func (DocumentedEnvelope) TransformSchema(r huma.Registry, s *huma.Schema) *huma.Schema {
	s.Description = "Envelope described by a Huma schema transformer."
	return s
}

type CreateDocumentedRequest struct {
	Identifier    string  `json:"identifier" doc:"The request identifier."`
	OptionalLabel *string `json:"optionalLabel,omitempty" nullable:"true"`
}

func (CreateDocumentedRequest) TransformSchema(r huma.Registry, s *huma.Schema) *huma.Schema {
	s.Description = "Request schema described by a Huma schema transformer."
	return s
}

type DeprecatedEnvelope struct {
	ActiveField     string `json:"activeField" doc:"Active field."`
	DeprecatedField string `json:"deprecatedField" doc:"Deprecated field." deprecated:"true"`
}

func (DeprecatedEnvelope) TransformSchema(r huma.Registry, s *huma.Schema) *huma.Schema {
	s.Description = "Deprecated envelope schema."
	s.Deprecated = true
	return s
}

type ValidatedEnvelope struct {
	Code   string `json:"code" doc:"Validated code." minLength:"2" maxLength:"8" pattern:"^[A-Z]+$" example:"AB"`
	Level  int    `json:"level" minimum:"1" maximum:"5" default:"3"`
	Status string `json:"status" enum:"draft,published"`
}

type RouteInput struct {
	ID string `path:"id" doc:"Route identifier."`
}

type QueryInput struct {
	PageSize int `query:"page-size" doc:"Page size."`
}

type HeaderInput struct {
	APIKey string `header:"x-api-key" doc:"API key." required:"true"`
}

type CombinedInput struct {
	ID       string `path:"id"`
	PageSize int    `query:"page-size"`
	APIKey   string `header:"x-api-key" required:"true"`
}

type BodyInput struct {
	Body CreateItemRequest
}

type CombinedBodyInput struct {
	ID       string `path:"id"`
	PageSize int    `query:"page-size"`
	APIKey   string `header:"x-api-key" required:"true"`
	Body     CreateItemRequest
}

type UserInput struct {
	UserID string `path:"user_id"`
}

type DuplicateParametersInput struct {
	ID       string `path:"id"`
	QueryID  string `query:"id"`
	HeaderID string `header:"id"`
}

type NormalizedCollisionInput struct {
	QueryKey  string `query:"x-api-key"`
	HeaderKey string `header:"x.api.key"`
}

type NormalizedDistinctInput struct {
	UserID      string `path:"user_id"`
	QueryUserID string `query:"user-id"`
	TenantID    string `header:"tenant.id"`
}

type CollisionBodyInput struct {
	ID           string `path:"id"`
	QueryAPIKey  string `query:"x-api-key"`
	HeaderAPIKey string `header:"x-api-key"`
	Body         CreateItemRequest
}

type TextInput struct {
	Body string `contentType:"text/plain"`
}

type ScopedTextInput struct {
	Scope   string `path:"scope"`
	TraceID string `header:"x-trace-id"`
	Body    string `contentType:"text/plain"`
}

type NumberListInput struct {
	Body []int `nullable:"false"`
}

type ScopedNumbersInput struct {
	Scope  string `path:"scope"`
	DryRun bool   `query:"dry-run"`
	Body   []int  `nullable:"false"`
}

type DocumentedGetInput struct {
	Filter string `query:"filter" doc:"Filter text from Huma parameter doc tags."`
}

type DocumentedPostInput struct {
	Body CreateDocumentedRequest `doc:"Documented request body."`
}

type DeprecatedInput struct {
	ID string `path:"id" doc:"Deprecated path parameter." deprecated:"true"`
}

type SimpleRecordOutput struct {
	Body SimpleRecord
}

type SimpleRecordArrayOutput struct {
	Body []SimpleRecord `nullable:"false"`
}

type SimpleRecordMapOutput struct {
	Body map[string]SimpleRecord
}

type EmptyOutput struct{}

type CollisionValueOutput struct {
	Body CollisionValueResponse
}

type DocumentOutput struct {
	ETag string `header:"etag" doc:"Entity tag."`
	Body DocumentResponse
}

type PlainMessageOutput struct {
	Body string
}

type NumberOutput struct {
	Body []int `nullable:"false"`
}

type MessageOutput struct {
	ETag string `header:"etag" doc:"Entity tag."`
	Body string
}

type NumberMessageOutput struct {
	ETag string `header:"etag" doc:"Entity tag."`
	Body []int  `nullable:"false"`
}

type TokenOutput struct {
	RequestID string `header:"x-request-id" doc:"Request identifier."`
}

type RateLimitsOutput struct {
	RateLimitHistory []int `header:"x-rate-limit-history" doc:"Recent remaining quota values."`
}

type ResponseCollisionOutput struct {
	ETag         string `header:"etag" doc:"Entity tag."`
	PrimaryKey   string `header:"x-api-key" doc:"Primary collision key."`
	SecondaryKey string `header:"x.api.key" doc:"Secondary collision key."`
	Body         ResponseCollisionBody
}

type NullabilityOutput struct {
	Body NullabilityEnvelope
}

type ObjectEnvelopeOutput struct {
	Body ObjectEnvelope
}

type HiddenEnvelopeOutput struct {
	Body HiddenEnvelope
}

type AttributedEnvelopeOutput struct {
	Body AttributedEnvelope
}

type NumericEnumOutput struct {
	Body NumericEnumEnvelope
}

type SymbolicEnumOutput struct {
	Body SymbolicEnumEnvelope
}

type DocumentedOutput struct {
	Body DocumentedEnvelope
}

type DeprecatedOutput struct {
	TraceID string `header:"x-trace-id" doc:"Deprecated trace header." deprecated:"true"`
	Body    DeprecatedEnvelope
}

type ValidatedOutput struct {
	Body ValidatedEnvelope
}

const okDescription = "OK"
const noContentDescription = "No Content"

func response(description string) map[string]*huma.Response {
	return map[string]*huma.Response{
		"200": {
			Description: description,
		},
	}
}

func noContentResponse() map[string]*huma.Response {
	return map[string]*huma.Response{
		"204": {
			Description: noContentDescription,
		},
	}
}

func register[I, O any](
	api huma.API,
	method string,
	path string,
	operationID string,
	summary string,
	description string,
	responses map[string]*huma.Response,
	handler func(context.Context, *I) (*O, error),
	handlers ...func(*huma.Operation),
) {
	op := huma.Operation{
		OperationID: operationID,
		Method:      method,
		Path:        path,
		Summary:     summary,
		Description: description,
		Responses:   responses,
	}
	for _, handler := range handlers {
		handler(&op)
	}
	huma.Register(api, op, handler)
}

func registerOperations(api huma.API) {
	register(api, http.MethodGet, "/route/{id}", "GetRouteValue", "", "", response(okDescription), func(ctx context.Context, input *RouteInput) (*SimpleRecordOutput, error) {
		return &SimpleRecordOutput{Body: SimpleRecord{ID: input.ID, Source: "route"}}, nil
	})
	register(api, http.MethodGet, "/query", "GetPage", "", "", response(okDescription), func(ctx context.Context, input *QueryInput) (*SimpleRecordOutput, error) {
		return &SimpleRecordOutput{Body: SimpleRecord{ID: "page", Source: "query"}}, nil
	})
	register(api, http.MethodGet, "/header", "GetHeaderValue", "", "", response(okDescription), func(ctx context.Context, input *HeaderInput) (*SimpleRecordOutput, error) {
		return &SimpleRecordOutput{Body: SimpleRecord{ID: input.APIKey, Source: "header"}}, nil
	})
	register(api, http.MethodGet, "/combined/{id}", "GetCombinedValue", "", "", response(okDescription), func(ctx context.Context, input *CombinedInput) (*SimpleRecordOutput, error) {
		return &SimpleRecordOutput{Body: SimpleRecord{ID: input.ID, Source: "combined"}}, nil
	})
	register(api, http.MethodPost, "/body", "CreateItem", "", "", response(okDescription), func(ctx context.Context, input *BodyInput) (*SimpleRecordOutput, error) {
		return &SimpleRecordOutput{Body: SimpleRecord{ID: input.Body.Name, Source: "body"}}, nil
	})
	register(api, http.MethodPost, "/combined/{id}", "CreateCombinedItem", "", "", response(okDescription), func(ctx context.Context, input *CombinedBodyInput) (*SimpleRecordOutput, error) {
		return &SimpleRecordOutput{Body: SimpleRecord{ID: input.ID, Source: input.Body.Name}}, nil
	})
	register(api, http.MethodGet, "/array", "ListItems", "", "", response(okDescription), func(ctx context.Context, input *struct{}) (*SimpleRecordArrayOutput, error) {
		return &SimpleRecordArrayOutput{Body: []SimpleRecord{{ID: "alpha", Source: "array"}}}, nil
	})
	register(api, http.MethodGet, "/dictionary", "MapItems", "", "", response(okDescription), func(ctx context.Context, input *struct{}) (*SimpleRecordMapOutput, error) {
		return &SimpleRecordMapOutput{Body: map[string]SimpleRecord{"alpha": {ID: "alpha", Source: "dictionary"}}}, nil
	})
	register(api, http.MethodDelete, "/items/{id}", "DeleteItem", "", "", noContentResponse(), func(ctx context.Context, input *RouteInput) (*EmptyOutput, error) {
		return &EmptyOutput{}, nil
	}, func(op *huma.Operation) {
		op.DefaultStatus = http.StatusNoContent
	})
	register(api, http.MethodGet, "/users/{user_id}", "GetUser", "", "", response(okDescription), func(ctx context.Context, input *UserInput) (*CollisionValueOutput, error) {
		return &CollisionValueOutput{Body: CollisionValueResponse{Value: input.UserID}}, nil
	})
	register(api, http.MethodGet, "/items/{id}", "GetDuplicateParameters", "", "", response(okDescription), func(ctx context.Context, input *DuplicateParametersInput) (*CollisionValueOutput, error) {
		return &CollisionValueOutput{Body: CollisionValueResponse{Value: input.ID}}, nil
	})
	register(api, http.MethodGet, "/normalized-collision", "GetNormalizedCollision", "", "", response(okDescription), func(ctx context.Context, input *NormalizedCollisionInput) (*CollisionValueOutput, error) {
		return &CollisionValueOutput{Body: CollisionValueResponse{Value: "normalized"}}, nil
	})
	register(api, http.MethodGet, "/normalized-distinct/{user_id}", "GetNormalizedDistinct", "", "", response(okDescription), func(ctx context.Context, input *NormalizedDistinctInput) (*CollisionValueOutput, error) {
		return &CollisionValueOutput{Body: CollisionValueResponse{Value: input.UserID}}, nil
	})
	register(api, http.MethodPost, "/items/{id}", "CreateCollisionItem", "", "", response(okDescription), func(ctx context.Context, input *CollisionBodyInput) (*CollisionValueOutput, error) {
		return &CollisionValueOutput{Body: CollisionValueResponse{Value: input.Body.Name}}, nil
	})
	register(api, http.MethodPost, "/text", "CreateText", "", "", noContentResponse(), func(ctx context.Context, input *TextInput) (*EmptyOutput, error) {
		return &EmptyOutput{}, nil
	}, func(op *huma.Operation) {
		op.DefaultStatus = http.StatusNoContent
	})
	register(api, http.MethodPost, "/text/{scope}", "CreateScopedText", "", "", noContentResponse(), func(ctx context.Context, input *ScopedTextInput) (*EmptyOutput, error) {
		return &EmptyOutput{}, nil
	}, func(op *huma.Operation) {
		op.DefaultStatus = http.StatusNoContent
	})
	register(api, http.MethodPost, "/number-list", "CreateNumberList", "", "", noContentResponse(), func(ctx context.Context, input *NumberListInput) (*EmptyOutput, error) {
		return &EmptyOutput{}, nil
	}, func(op *huma.Operation) {
		op.DefaultStatus = http.StatusNoContent
	})
	register(api, http.MethodPut, "/numbers/{scope}", "UpdateNumbers", "", "", noContentResponse(), func(ctx context.Context, input *ScopedNumbersInput) (*EmptyOutput, error) {
		return &EmptyOutput{}, nil
	}, func(op *huma.Operation) {
		op.DefaultStatus = http.StatusNoContent
	})
	register(api, http.MethodGet, "/token", "GetToken", "", "", response(okDescription), func(ctx context.Context, input *struct{}) (*TokenOutput, error) {
		return &TokenOutput{RequestID: "request"}, nil
	}, func(op *huma.Operation) {
		op.DefaultStatus = http.StatusOK
	})
	register(api, http.MethodGet, "/document", "GetDocument", "", "", response(okDescription), func(ctx context.Context, input *struct{}) (*DocumentOutput, error) {
		return &DocumentOutput{ETag: "tag", Body: DocumentResponse{Value: "alpha"}}, nil
	})
	register(api, http.MethodGet, "/plain-message", "GetPlainMessage", "", "", response(okDescription), func(ctx context.Context, input *struct{}) (*PlainMessageOutput, error) {
		return &PlainMessageOutput{Body: "hello"}, nil
	})
	register(api, http.MethodGet, "/numbers", "GetNumbers", "", "", response(okDescription), func(ctx context.Context, input *struct{}) (*NumberOutput, error) {
		return &NumberOutput{Body: []int{1, 2, 3}}, nil
	})
	register(api, http.MethodGet, "/message", "GetMessage", "", "", response(okDescription), func(ctx context.Context, input *struct{}) (*MessageOutput, error) {
		return &MessageOutput{ETag: "tag", Body: "hello"}, nil
	})
	register(api, http.MethodGet, "/number-message", "GetNumberMessage", "", "", response(okDescription), func(ctx context.Context, input *struct{}) (*NumberMessageOutput, error) {
		return &NumberMessageOutput{ETag: "tag", Body: []int{1, 2, 3}}, nil
	})
	register(api, http.MethodGet, "/rate-limits", "GetRateLimits", "", "", response(okDescription), func(ctx context.Context, input *struct{}) (*RateLimitsOutput, error) {
		return &RateLimitsOutput{RateLimitHistory: []int{3, 2, 1}}, nil
	}, func(op *huma.Operation) {
		op.DefaultStatus = http.StatusOK
	})
	register(api, http.MethodGet, "/response-collision", "GetResponseCollision", "", "", response(okDescription), func(ctx context.Context, input *struct{}) (*ResponseCollisionOutput, error) {
		return &ResponseCollisionOutput{ETag: "tag", PrimaryKey: "one", SecondaryKey: "two", Body: ResponseCollisionBody{ETag: "body"}}, nil
	})
	register(api, http.MethodGet, "/nullability", "GetNullability", "", "", response(okDescription), func(ctx context.Context, input *struct{}) (*NullabilityOutput, error) {
		return &NullabilityOutput{Body: NullabilityEnvelope{}}, nil
	})
	register(api, http.MethodGet, "/schemas/object", "GetObjectEnvelope", "", "", response(okDescription), func(ctx context.Context, input *struct{}) (*ObjectEnvelopeOutput, error) {
		return &ObjectEnvelopeOutput{Body: ObjectEnvelope{}}, nil
	})
	register(api, http.MethodGet, "/schemas/hidden", "GetHiddenEnvelope", "", "", response(okDescription), func(ctx context.Context, input *struct{}) (*HiddenEnvelopeOutput, error) {
		return &HiddenEnvelopeOutput{Body: HiddenEnvelope{}}, nil
	})
	register(api, http.MethodGet, "/schemas/attribute", "GetAttributedEnvelope", "", "", response(okDescription), func(ctx context.Context, input *struct{}) (*AttributedEnvelopeOutput, error) {
		return &AttributedEnvelopeOutput{Body: AttributedEnvelope{}}, nil
	})
	register(api, http.MethodGet, "/enum/numeric", "GetNumericEnum", "", "", response(okDescription), func(ctx context.Context, input *struct{}) (*NumericEnumOutput, error) {
		return &NumericEnumOutput{Body: NumericEnumEnvelope{}}, nil
	})
	register(api, http.MethodGet, "/enum/symbolic", "GetSymbolicEnum", "", "", response(okDescription), func(ctx context.Context, input *struct{}) (*SymbolicEnumOutput, error) {
		return &SymbolicEnumOutput{Body: SymbolicEnumEnvelope{}}, nil
	})
	register(api, http.MethodGet, "/comments/documented", "GetDocumented", "Returns a documented response.", "First detail line.\nSecond detail line.", response("Huma documented success response."), func(ctx context.Context, input *DocumentedGetInput) (*DocumentedOutput, error) {
		return &DocumentedOutput{Body: DocumentedEnvelope{Title: "title"}}, nil
	})
	register(api, http.MethodPost, "/comments/documented", "CreateDocumented", "Creates a documented response.", "", response("Huma documented create response."), func(ctx context.Context, input *DocumentedPostInput) (*DocumentedOutput, error) {
		return &DocumentedOutput{Body: DocumentedEnvelope{Title: input.Body.Identifier}}, nil
	})
	register(api, http.MethodGet, "/deprecated/{id}", "DeprecatedOperation", "Deprecated operation summary.", "", response(okDescription), func(ctx context.Context, input *DeprecatedInput) (*DeprecatedOutput, error) {
		return &DeprecatedOutput{TraceID: "trace", Body: DeprecatedEnvelope{ActiveField: "active", DeprecatedField: "legacy"}}, nil
	}, func(op *huma.Operation) {
		op.Deprecated = true
	})
	register(api, http.MethodGet, "/validated", "GetValidatedEnvelope", "", "", response(okDescription), func(ctx context.Context, input *struct{}) (*ValidatedOutput, error) {
		return &ValidatedOutput{Body: ValidatedEnvelope{}}, nil
	})
}

func main() {
	mux := http.NewServeMux()
	api := humago.New(mux, huma.DefaultConfig("Modesta Huma Fixture", "1.0.0"))
	registerOperations(api)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8888"
	}
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		panic(err)
	}
}
